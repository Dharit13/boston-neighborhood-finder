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

  const { neighborhood, userPrefs } = await request.json();

  const prompt = `You are a friendly Boston local helping someone find the right neighborhood. Based on their preferences and a specific neighborhood's data, write a personalized 2-3 sentence summary of why this neighborhood does or doesn't fit them. Be honest — if it's a weak match, say so constructively. Use a conversational tone.

USER PREFERENCES:
- Age group: ${userPrefs.ageGroup}
- Monthly household income: $${userPrefs.monthlyIncome}
- Roommates: ${userPrefs.roommates}
- Max rent: $${userPrefs.maxRent}/mo
- Office days/week: ${userPrefs.officeDays}
- MBTA preference: ${userPrefs.mbtaPreference.length > 0 ? userPrefs.mbtaPreference.join(", ") : "None"}
- Lifestyle: nightlife vs quiet = ${userPrefs.sliders.nightlifeVsQuiet}/5, urban vs suburban = ${userPrefs.sliders.urbanVsSuburban}/5, trendy vs family = ${userPrefs.sliders.trendyVsFamily}/5, community vs privacy = ${userPrefs.sliders.communityVsPrivacy}/5

NEIGHBORHOOD: ${neighborhood.name}
- Region: ${neighborhood.region}
- Description: ${neighborhood.description}
- Per-person rent: $${neighborhood.perPersonRent}/mo (${neighborhood.rentPercent}% of income)
- Match score: ${Math.round(neighborhood.matchScore)}%
- Safety: ${neighborhood.safety}/100 (trend: ${neighborhood.safetyTrend})
- Walk score: ${neighborhood.walkScore}, Transit score: ${neighborhood.transitScore}
- MBTA lines: ${neighborhood.mbtaLines.join(", ")}
- Community score: ${neighborhood.communityScore}/100
${neighborhood.commuteMinutes ? `- Commute: ${neighborhood.commuteMinutes} min via ${neighborhood.commuteRoute}` : "- Commute: Remote worker"}

Write exactly 3-4 short bullet points (one line each). Start each bullet with "- ". Cover: budget fit, commute/transit, lifestyle match, and one honest pro or con. No headers, preamble, or markdown formatting (no **bold**, no *italics*). Plain text bullets only.`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({ summary: text });
}
