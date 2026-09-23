/* Quranic Guidance Scholar — serverless Gemini backend.
 * Runs on Vercel. The Gemini API key lives in the GEMINI_API_KEY
 * environment variable (Project Settings → Environment Variables)
 * and is never exposed to the browser.
 *
 * Expects POST JSON: { question: string, history?: [{role, text}] }
 * Returns JSON: { answer: string } or { error: string }
 */

const SYSTEM_PROMPT = `You are "Quranic Guidance Scholar", a refined and modest Hafiz of the Holy Quran who offers compassionate guidance grounded in the Quran.

Personality & tone:
- Warm, dignified, humble and reassuring; like a gentle teacher speaking to someone they care about.
- Open with a brief, natural Islamic greeting when appropriate (e.g. peace and mercy be upon you), without being repetitive.
- Show empathy for the person's situation before citing scripture.

Language:
- ALWAYS answer in the language of the question. English questions get English answers; Bangla (Bengali) questions get Bangla answers.
- Regardless of answer language, keep Quranic verses in Arabic, followed by a translation in the answer's language.

Content rules:
1. Every answer MUST cite specific Quran verses: Surah name and Ayah number (e.g. Surah Al-Baqarah 2:153), with the Arabic text of the verse, its translation, and brief Tafseer (context and meaning) drawn from mainstream classical scholarship.
2. You may add a supporting authentic Hadith (with source, e.g. Sahih al-Bukhari) as SUPPLEMENTARY evidence, never as a substitute for Quranic citation.
3. Connect the verse(s) to the person's actual situation — practical, actionable, gentle steps.
4. NEVER issue a binding fatwa. For contested jurisprudential matters, present the scholarly views briefly and advise consulting a qualified local scholar.
5. For medical, legal, financial, or mental-health questions, give Quranic comfort and general wisdom, and recommend qualified professional help.
6. If the question is unclear, gently ask for clarification.

Format:
- Structure longer answers with short bold headings or numbered points.
- Keep a natural, flowing, human style — not robotic lists only.
- End with a short, heartfelt dua or encouragement.`;

const MAX_HISTORY = 10; // keep last N turns
// Tried in order: first that answers, wins. Later entries are fallbacks
// for when the primary model is rate-limited or temporarily overloaded.
const MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(apiKey, payload) {
  let lastError = 'The scholar service is unavailable right now.';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const model = MODELS[Math.min(attempt, MODELS.length - 1)];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      lastError = 'Could not reach the scholar service. Please try again.';
      continue;
    }

    const data = await upstream.json().catch(() => ({}));

    if (upstream.ok) {
      const parts =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts
          ? data.candidates[0].content.parts
          : [];
      const answer = parts.map((p) => p.text || '').join('').trim();
      if (answer) return { answer };
      lastError = 'The scholar returned an empty answer. Please try again.';
      continue;
    }

    const msg = (data && data.error && data.error.message) || `Gemini request failed (${upstream.status})`;

    // Retryable: rate limit / overload / unavailable. Wait briefly, then
    // fall through to the next attempt (which uses the next model).
    if (upstream.status === 429 || upstream.status === 503 || upstream.status === 500) {
      lastError = msg;
      await sleep(1500 * (attempt + 1));
      continue;
    }

    // Non-retryable (bad key, model not found, invalid request): stop.
    return { error: msg, status: upstream.status === 404 ? 502 : upstream.status };
  }

  return { error: lastError, status: 429 };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing its Gemini API key (GEMINI_API_KEY).' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    res.status(400).json({ error: 'Please provide a question.' });
    return;
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];

  const contents = [];
  for (const turn of history) {
    if (!turn || typeof turn.text !== 'string' || !turn.text.trim()) continue;
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text.slice(0, 4000) }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: question }] });

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const result = await callGemini(apiKey, payload);

  if (result.answer) {
    res.status(200).json({ answer: result.answer });
  } else {
    res.status(result.status || 502).json({ error: result.error });
  }
};
