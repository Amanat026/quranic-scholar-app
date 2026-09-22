# Quranic Guidance Scholar — কুরআনিক দিকনির্দেশনা

A mobile-responsive, **bilingual (English & Bangla)** web app with **voice message support** in both languages. Users ask questions — by typing or speaking — and receive guidance grounded in the Holy Quran, with Surah/Ayah citations, Tafseer, and practical advice. Answers come from an AI scholar agent on n8n (Google Gemini).

## Features

- **Bilingual UI** — one-tap switch between English and Bangla (বাংলা); the whole interface and the scholar's answers follow the selected language
- **Voice messages** — tap the mic and speak in English or Bangla; speech is transcribed in the browser (Web Speech API, `en-US` / `bn-BD`) and sent as the question
- **Conversation memory** — each visitor gets a persistent session, so follow-up questions keep context
- **Quran-grounded answers** — every reply cites Surah & Ayah, includes Arabic verse text, and gives Tafseer in the user's language

## How it works

```
Browser (type or voice → text)
   → POST /webhook/quran-scholar (n8n)
   → AI Scholar Agent (Gemini, bilingual)
   → JSON { answer, sessionId }
```

## Project structure

```
├── index.html          # App markup (header, chat, composer, mic, lang switch)
├── assets/
│   ├── app.js          # Chat logic, language switching, speech recognition, API calls
│   └── styles.css      # Mobile-first responsive styles (green/gold theme)
├── vercel.json         # Vercel static-site config
└── README.md
```

## Setup

### 1. Configure the API endpoint

In `assets/app.js`:

```js
const API_URL = 'https://amanat26.app.n8n.cloud/webhook/quran-scholar';
```

The n8n workflow "Quranic Scholar — Web API Endpoint" must be **published (active)** for the API to answer.

### 2. Run locally

```bash
npx serve .
# or
python3 -m http.server 8080
```

Voice input requires **HTTPS** (or `localhost`) and microphone permission — most browsers block mic access on plain `http://` origins.

### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or import this repo in the Vercel dashboard — static site, zero config. Vercel provides HTTPS, so the mic works there.

## API contract

**Request** `POST {API_URL}`
```json
{ "question": "কঠিন সময়ে ধৈর্য সম্পর্কে কুরআন কী বলে?", "sessionId": "optional" }
```

**Response** `200 OK`
```json
{ "answer": "বিসমিল্লাহ… (সূরা আল-বাকারা ২:১৫৩)…", "sessionId": "abc-123" }
```

**Errors**
- `400` — missing or empty `question`
- `500` — scholar service error

`sessionId` keeps each visitor's conversation memory; the app stores it in `localStorage`.

## Browser support for voice

| Browser | English | Bangla |
|---|---|---|
| Chrome / Edge (Android, desktop) | ✅ | ✅ |
| Safari (iOS 17+) | ✅ | Partial (uses on-device speech) |
| Firefox | ❌ (no Web Speech API) — typing still works | ❌ |

When voice is unavailable, the app shows a friendly message and typing keeps working.

## Notes

- Answers cite the Quran (Surah:Ayah) as the primary source; authentic Hadith only as support.
- For binding rulings (fatawa), the scholar encourages consulting qualified scholars — it offers guidance, not verdicts.
- CORS is enabled on the endpoint for all origins during development; restrict it to your Vercel domain in the n8n workflow for production.
