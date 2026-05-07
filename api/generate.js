export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
        return res.status(200).end();
  }

  if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
        console.error("Missing ANTHROPIC_API_KEY env var");
        return res.status(500).json({ error: "Server not configured" });
  }

  const { businessType, audience, offer, platform, voice } = req.body || {};

  if (!businessType || !audience || !offer || !platform || !voice) {
        return res.status(400).json({
                error: "Missing required fields: businessType, audience, offer, platform, voice",
        });
  }

  const prompt = `You are HustleFlow, an underdog AI marketing coach. Generate marketing content for a small business.

  Business: ${businessType}
  Audience: ${audience}
  Offer: ${offer}
  Platform: ${platform}
  Brand Voice: ${voice}

  Voice Guide for "${voice}":
  - Street Motivational: Raw, reflective, empowering. Pull people in. Talk about pain, growth, power. Use phrases like "Look...", "Real talk...", "Out the mud". Street smarts meets spiritual wisdom. Always close with impact.
  - Professional: Clear, confident, results-focused. Polished but warm.
  - Luxury: Refined, exclusive, aspirational. Premium language.
  - Funny: Playful, witty, scroll-stopping humor.
  - Community Builder: Warm, inclusive, "we" language. Belonging-focused.
  - Wellness & Hustle: Healthy ambition, balance, sustainable grit.

  Return ONLY a valid JSON object (no markdown, no preamble) with this exact shape:
  {
    "caption": "social caption optimized for ${platform}, 2-4 short paragraphs with line breaks",
      "emailSubject": "scroll-stopping email subject line under 60 chars",
        "adHook": "first-line ad hook that stops the scroll, under 15 words",
          "cta": "specific call-to-action button text, 3-6 words",
            "hashtags": ["array", "of", "8", "relevant", "hashtags", "without", "the", "hash"],
              "videoScript": "30-second short video script with [HOOK], [BUILD], [PAYOFF], [CTA] sections labeled inline"
              }`;

  try {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                          "Content-Type": "application/json",
                          "x-api-key": process.env.ANTHROPIC_API_KEY,
                          "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                          model: "claude-sonnet-4-5-20250929",
                          max_tokens: 1500,
                          messages: [{ role: "user", content: prompt }],
                }),
        });

      if (!anthropicRes.ok) {
              const errText = await anthropicRes.text();
              console.error("Anthropic API error:", anthropicRes.status, errText);
              return res
                .status(anthropicRes.status)
                .json({ error: "AI service returned an error" });
      }

      const data = await anthropicRes.json();
        const text = (data.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");

      const clean = text.replace(/```json|```/g, "").trim();

      let parsed;
        try {
                parsed = JSON.parse(clean);
        } catch (parseErr) {
                console.error("JSON parse error:", parseErr, "raw:", clean);
                return res
                  .status(502)
                  .json({ error: "AI returned malformed output. Try again." });
        }

      return res.status(200).json(parsed);
  } catch (err) {
        console.error("Generation error:", err);
        return res.status(500).json({ error: "Generation failed" });
  }
}
