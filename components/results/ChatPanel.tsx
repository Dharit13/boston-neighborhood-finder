"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAiErrorState, formatResetAt } from "./useAiErrorState";
import type { ChatMessage, ScoredNeighborhood, UserInput } from "@/lib/types";

interface Props {
  userInput: UserInput | null;
  recommendations: Array<{
    neighborhood: ScoredNeighborhood;
    label: string;
    color: string;
  }>;
}

const STORAGE_KEY = "bnh:chat";
const MAX_MESSAGES = 10;
const MAX_CONTENT_CHARS = 2000;

interface PersistedState {
  messages: ChatMessage[];
}

function loadPersisted(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.messages)) return [];
    return parsed.messages.slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

function persist(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages } satisfies PersistedState)
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function stripMarkdown(text: string): string {
  // Defensive: model is instructed to output plain text, but sometimes leaks
  // **bold**, `code`, or leading #/- list markers. Strip them on render.
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export default function ChatPanel({ userInput, recommendations }: Props) {
  const { error, handleResponse, reauth } = useAiErrorState();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist on every messages change AFTER the first load.
  // This effect only writes to sessionStorage; it never calls setState,
  // so the react-hooks/set-state-in-effect rule doesn't apply.
  useEffect(() => {
    if (hasLoaded) persist(messages);
  }, [messages, hasLoaded]);

  // Auto-scroll to bottom on new content. No setState — just DOM mutation.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Load sessionStorage lazily on first open (event handler, not an effect).
  const handleOpen = useCallback(() => {
    if (!hasLoaded) {
      setMessages(loadPersisted());
      setHasLoaded(true);
    }
    setOpen(true);
  }, [hasLoaded]);

  const topPick = recommendations[0]?.neighborhood.neighborhood.name ?? null;

  const suggestions = topPick
    ? [
        `Why is ${topPick} my best match?`,
        "Compare the top 3 on commute",
        `What's nearby ${topPick}?`,
      ]
    : [
        "Which neighborhoods are cheapest?",
        "Where's safest on the Red Line?",
        "Best for remote workers?",
      ];

  const handleClose = useCallback(() => {
    setOpen(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    setErrorMsg(null);
    setDraft("");
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;
      if (content.length > MAX_CONTENT_CHARS) {
        setErrorMsg(`Message too long (max ${MAX_CONTENT_CHARS} chars).`);
        return;
      }
      setErrorMsg(null);

      const userMsg: ChatMessage = { role: "user", content };
      const history = [...messages, userMsg].slice(-MAX_MESSAGES);
      setMessages([...history, { role: "assistant", content: "" }]);
      setDraft("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const recSummary =
        recommendations.slice(0, 3).map((r) => ({
          id: r.neighborhood.neighborhood.id,
          name: r.neighborhood.neighborhood.name,
          label: r.label,
          matchScore: r.neighborhood.matchScore,
        })) || null;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            userPrefs: userInput,
            recommendations: recSummary.length > 0 ? recSummary : null,
          }),
          signal: controller.signal,
        });

        const ok = await handleResponse(res);
        if (!ok) {
          setMessages((prev) => prev.slice(0, -1)); // remove the assistant placeholder
          return;
        }
        if (!res.body) {
          setErrorMsg("Couldn't reach the assistant. Try again in a moment.");
          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            if (!evt.startsWith("data: ")) continue;
            let parsed: { type: string; delta?: string; message?: string };
            try {
              parsed = JSON.parse(evt.slice(6));
            } catch {
              continue;
            }
            if (parsed.type === "text" && parsed.delta) {
              accumulated += parsed.delta;
              setMessages((prev) => {
                const copy = prev.slice();
                copy[copy.length - 1] = { role: "assistant", content: accumulated };
                return copy;
              });
            } else if (parsed.type === "error") {
              setErrorMsg("Couldn't reach the assistant. Try again in a moment.");
              setMessages((prev) => prev.slice(0, -1));
              return;
            } else if (parsed.type === "done") {
              if (accumulated.trim().length === 0) {
                setMessages((prev) => {
                  const copy = prev.slice();
                  copy[copy.length - 1] = {
                    role: "assistant",
                    content:
                      "I don't have a good answer for that — try rephrasing?",
                  };
                  return copy;
                });
              }
              return;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMsg("Couldn't reach the assistant. Try again in a moment.");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setStreaming(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [messages, streaming, userInput, recommendations, handleResponse]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        title="Ask about these neighborhoods"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-2xl hover:scale-105 transition-transform flex items-center justify-center"
        aria-label="Open chat assistant"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-3rem)] flex flex-col rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="text-white font-semibold text-sm">Ask the assistant</h3>
          <p className="text-white/60 text-xs">I know these 44 Boston neighborhoods.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-white/60 hover:text-white"
          >
            Clear chat
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/70 hover:text-white text-xl leading-none"
            aria-label="Close chat"
          >
            &times;
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-white/80">
              Hi! I can help you compare these neighborhoods and answer questions
              about rent, transit, safety, and fit.
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-500/30 border border-blue-400/30 text-white"
                  : "bg-white/10 border border-white/10 text-white"
              }`}
            >
              {m.role === "assistant" ? stripMarkdown(m.content) : m.content}
              {streaming && i === messages.length - 1 && m.role === "assistant" && (
                <span className="inline-block w-1 h-3 ml-0.5 bg-white/70 animate-pulse" />
              )}
            </div>
          </div>
        ))}

        {errorMsg && (
          <p className="text-xs text-red-300 italic">{errorMsg}</p>
        )}
        {error?.kind === "unauthorized" && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg">
            Your session expired.{" "}
            <button onClick={reauth} className="underline">Sign in again</button>
          </div>
        )}
        {error?.kind === "rateLimited" && (
          <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-lg">
            You&apos;ve used all 20 of your hourly AI requests. {formatResetAt(error.resetAt)}
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a neighborhood…"
            rows={1}
            maxLength={MAX_CONTENT_CHARS}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={() => send(draft)}
            disabled={streaming || draft.trim().length === 0}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            Send
          </button>
        </div>
        {draft.length > 100 && (
          <p className="text-xs text-white/40 mt-1 text-right">
            {draft.length}/{MAX_CONTENT_CHARS}
          </p>
        )}
      </div>
    </div>
  );
}
