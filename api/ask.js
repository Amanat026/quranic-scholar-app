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
const MODEL = 'gemini-3.6-flash';

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const msg = (data && data.error && data.error.message) || `Gemini request failed (${upstream.status})`;
      res.status(upstream.status === 429 ? 429 : 502).json({ error: msg });
      return;
    }

    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
        ? data.candidates[0].content.parts
        : [];

    const answer = parts.map((p) => p.text || '').join('').trim();

    if (!answer) {
      res.status(502).json({ error: 'The scholar returned an empty answer. Please try again.' });
      return;
    }

    res.status(200).json({ answer });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the scholar service. Please try again.' });
  }
};
