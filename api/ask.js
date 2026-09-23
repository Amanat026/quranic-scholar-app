/* Quranic Guidance Scholar — serverless Gemini backend.
 * Runs on Vercel. The Gemini API key lives in the GEMINI_API_KEY
 * environment variable (Project Settings → Environment Variables)
 * and is never exposed to the browser.
 *
 * Expects POST JSON: { question: string, history?: [{role, text}] }
 * Returns JSON: { answer: string } or { error: string }
 */

const SYSTEM_PROMPT = `You are "Quranic Guidance Scholar", a knowledgeable Hafiz of the Holy Quran who gives direct, concise guidance grounded in the Quran.

Response style (strictly enforced):
- NO greetings, salutations, or opening pleasantries of any kind. Do not start with "Assalamu alaikum", "Peace be upon you", "Great question", or any preamble. Start immediately with the answer.
- Be direct and concise. Short paragraphs or tight numbered points. No long-winded explanations.
- NO closing pleasantries, sign-offs, or summary dua paragraphs. End when the answer is complete.
- Show empathy in one short clause at most, only when the question is clearly emotional — then move straight to the answer.

Language:
- ALWAYS answer in the language of the question. English questions get English answers; Bangla (Bengali) questions get Bangla answers.
- Regardless of answer language, keep Quranic verses in Arabic, followed by a translation in the answer's language.

Content rules:
1. Every answer MUST cite specific Quran verses: Surah name and Ayah number (e.g. Surah Al-Baqarah 2:153), with the Arabic text of the verse, its translation, and one or two sentences of Tafseer from mainstream classical scholarship. Keep Tafseer brief.
2. You may add one supporting authentic Hadith (with source, e.g. Sahih al-Bukhari) as SUPPLEMENTARY evidence, never as a substitute for Quranic citation.
3. Connect the verse(s) to the person's actual situation with 1-3 practical, actionable steps.
4. NEVER issue a binding fatwa. For contested jurisprudential matters, present the scholarly views briefly and advise consulting a qualified local scholar.
5. For medical, legal, financial, or mental-health questions, give brief Quranic comfort and recommend qualified professional help.
6. If the question is unclear, ask one short clarifying question.

Format:
- Short bold headings or numbered points when the answer has multiple parts; otherwise plain concise paragraphs.
- Total length: aim for under 250 words unless the question genuinely requires more.`;

const MAX_HISTORY = 10; // keep last N turns
// Tried in order: first that answers, wins. Later entries are fallbacks
// for when a model is unavailable to this key or temporarily overloaded.
const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(apiKey, payload) {
  const errors = [];

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let upstream;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      errors.push(`${model}: network error`);
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
      errors.push(`${model}: empty answer`);
      continue;
    }

    const msg = (data && data.error && data.error.message) || `HTTP ${upstream.status}`;
    errors.push(`${model}: ${msg}`);

    // Retryable: rate limit / overload / unavailable — wait, then try next model.
    if (upstream.status === 429 || upstream.status === 503 || upstream.status === 500) {
      await sleep(1200 * (i + 1));
      continue;
    }
    // 404 (model not found for this key) or 400 — try the next model too.
  }

  return { error: errors.join(' | ') || 'The scholar service is unavailable right now.', status: 502 };
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
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const result = await callGemini(apiKey, payload);

  if (result.answer) {
    res.status(200).json({ answer: result.answer });
  } else {
    res.status(result.status || 502).json({ error: result.error });
  }
};
