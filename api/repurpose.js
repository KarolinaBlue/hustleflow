export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(500).json({ error: "Server not configured" });
        }

    const { sourceContent, voice } = req.body || {};

    if (!sourceContent || !voice) {
          return res.status(400).json({ error: "Missing required fields: sourceContent, voice" });
        }

    const prompt = `You are HustleFlow, an underdog AI marketing coach. Take this source content and repurpose it across formats in the "${voice}" voice.

  Source content:
  """
${sourceContent}
"""

  Return ONLY a valid JSON object (no markdown) with this shape:
  {
      "instagramPost": "engaging IG caption with line breaks",
      "twitterThread": "3-tweet thread separated by ' / / / '",
      "emailIntro": "warm 2-paragraph email opener",
      "carouselSlides": ["Slide 1: hook", "Slide 2: point", "Slide 3: point", "Slide 4: point", "Slide 5: CTA"],
      "shortVideoScript": "30-second video script with sections"
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
                  return res.status(anthropicRes.status).json({ error: "AI service returned an error" });
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
                  return res.status(502).json({ error: "AI returned malformed output. Try again." });
                }

          return res.status(200).json(parsed);
        } catch (err) {
          console.error("Repurpose error:", err);
          return res.status(500).json({ error: "Repurpose failed" });
        }
  }
