import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, ipFromRequest } from "@/lib/rateLimit";
import {
  buildSystemPrompt,
  preCheck,
  type RecommendationSummary,
} from "@/lib/chatPrompt";
import { COMPACT_SUMMARY, findMentioned } from "@/lib/neighborhoodsServer";
import type { ChatMessage, UserInput } from "@/lib/types";

const MAX_MESSAGES = 10;
const MAX_CONTENT_CHARS = 2000;
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;

const REFUSAL_TEXT =
  "I can only help with questions about the 44 Boston-area neighborhoods in this app. Try asking about one of them — for example, rent, transit, safety, or lifestyle fit.";

interface RequestBody {
  messages: ChatMessage[];
  userPrefs: UserInput | null;
  recommendations: RecommendationSummary[] | null;
}

function isValidMessage(m: unknown): m is ChatMessage {
  if (typeof m !== "object" || m === null) return false;
  const msg = m as Record<string, unknown>;
  if (msg.role !== "user" && msg.role !== "assistant") return false;
  if (typeof msg.content !== "string") return false;
  if (msg.content.length === 0) return false;
  if (msg.content.length > MAX_CONTENT_CHARS) return false;
  return true;
}

function validateBody(raw: unknown): RequestBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.messages)) return null;
  if (body.messages.length === 0 || body.messages.length > MAX_MESSAGES) return null;
  if (!body.messages.every(isValidMessage)) return null;
  const last = body.messages[body.messages.length - 1];
  if (last.role !== "user") return null;
  return {
    messages: body.messages as ChatMessage[],
    userPrefs: (body.userPrefs as UserInput | null) ?? null,
    recommendations: (body.recommendations as RecommendationSummary[] | null) ?? null,
  };
}

function sseEncode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function refusalStream(): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseEncode({ type: "text", delta: REFUSAL_TEXT }));
      controller.enqueue(sseEncode({ type: "done" }));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }

  const ip = ipFromRequest(request);
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: rl.resetSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetSeconds) } }
    );
  }

  let body: RequestBody | null;
  try {
    body = validateBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const lastUser = body.messages[body.messages.length - 1];
  if (preCheck(lastUser.content) === "refuse_out_of_scope") {
    return refusalStream();
  }

  const mentionedDetails = findMentioned(lastUser.content);
  const systemPrompt = buildSystemPrompt({
    compact: COMPACT_SUMMARY,
    mentionedDetails,
    userPrefs: body.userPrefs,
    recommendations: body.recommendations,
  });

  const client = new Anthropic({ apiKey });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              sseEncode({ type: "text", delta: event.delta.text })
            );
          }
        }

        controller.enqueue(sseEncode({ type: "done" }));
        controller.close();
      } catch (err) {
        console.error("[api/chat] stream failed", err);
        controller.enqueue(sseEncode({ type: "error", message: "stream_failed" }));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
