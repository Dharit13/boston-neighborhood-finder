import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    );
  }

  const rl = await checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", resetAt: rl.resetAt },
      { status: 429 }
    );
  }

  const { recommendations, userPrefs } = await request.json();

  // Input validation
  if (
    !Array.isArray(recommendations) || recommendations.length === 0 ||
    !userPrefs || typeof userPrefs !== "object" ||
    typeof userPrefs.ageGroup !== "string" || userPrefs.ageGroup.trim().length === 0
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  interface RecSummary {
    name: string;
    label: string;
    matchScore: number;
    perPersonRent: number;
    rentPercent: number;
    commuteMinutes: number | null;
    commuteRoute: string | null;
    safety: number;
    walkScore: number;
    mbtaLines: string[];
    stations?: string;
    description: string;
  }

  const recSummaries = (recommendations as RecSummary[])
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} (${r.label})
   - Match: ${r.matchScore}% | Rent: $${r.perPersonRent}/mo (${r.rentPercent}% of income)
   - Commute: ${r.commuteMinutes ? `${r.commuteMinutes} min via ${r.commuteRoute}` : "Remote"}
   - Safety: ${r.safety}/100 | Walk Score: ${r.walkScore}
   - Transit: ${r.mbtaLines.join(", ")}
   - Stations: ${r.stations || "N/A"}
   - Key traits: ${r.description}`
    )
    .join("\n");

  const prompt = `You are a friendly Boston neighborhood expert. A user is looking for a place to live and our algorithm picked 3 neighborhoods for them. Write a brief 3-4 sentence overview explaining WHY these specific neighborhoods were selected and how they complement each other as options. Be conversational and specific — mention actual neighborhood names, key differentiators, and how they map to the user's priorities.

USER PROFILE:
- Age: ${userPrefs.ageGroup}
- Income: $${userPrefs.monthlyIncome}/mo
- Roommates: ${userPrefs.roommates}
- Max rent: $${userPrefs.maxRent}/mo
- Office days: ${userPrefs.officeDays}/week
- Office: ${userPrefs.officeAddress || "Remote"}
- MBTA pref: ${userPrefs.mbtaPreference?.length > 0 ? userPrefs.mbtaPreference.join(", ") : "None"}
- Style: nightlife=${userPrefs.sliders.nightlifeVsQuiet}/5, urban=${userPrefs.sliders.urbanVsSuburban}/5, trendy=${userPrefs.sliders.trendyVsFamily}/5, community=${userPrefs.sliders.communityVsPrivacy}/5

TOP 3 RECOMMENDATIONS:
${recSummaries}

Write a one-line intro sentence, then exactly one "- " bullet per neighborhood (3 bullets total) explaining why it was picked and what makes it unique for this user. Keep each bullet to 1-2 sentences. No headers, preamble, or markdown formatting (no **bold**, no *italics*). Plain text only.`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({ overview: text });
}
