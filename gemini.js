// Minimal Gemini REST client - no SDK, free-tier key from Google AI Studio.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const KEY = process.env.GEMINI_API_KEY;

async function blurt(prompt) {
  if (!KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.95, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let clean = text.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0].trim();
    if (clean.length > 140) {
      const m = clean.slice(0, 141).match(/^(.*[.!?])[^.!?]*$/);
      clean = (m && m[1].length >= 20 ? m[1] : clean.slice(0, clean.lastIndexOf(' ', 137))).trim();
    }
    return clean || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { blurt, enabled: !!KEY, MODEL };
