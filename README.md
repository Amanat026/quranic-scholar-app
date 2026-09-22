# Quranic Guidance Scholar

A mobile-responsive web app where users ask questions and receive guidance grounded in the Holy Quran — with Surah/Ayah citations, Tafseer, and practical advice. The answers come from an AI scholar agent running on n8n (Google Gemini).

## How it works

```
User's browser  →  POST /webhook/quran-scholar (n8n)  →  AI Scholar Agent  →  JSON answer
```

The frontend is a single static page (`index.html`) — no build tools, no frameworks. It calls the n8n webhook endpoint and renders the scholar's answer.

## Project structure

```
├── index.html          # The entire app (markup + styles + logic)
├── assets/
│   └── app.js          # Chat logic: API calls, session handling, rendering
│   └── styles.css      # Mobile-first responsive styles
├── vercel.json         # Vercel deployment config (static site)
└── README.md           # This file
```

## Setup

### 1. Configure the API endpoint

Open `assets/app.js` and set:

```js
const API_URL = 'https://amanat26.app.n8n.cloud/webhook/quran-scholar';
```

This endpoint is provided by the companion n8n workflow "Quranic Scholar — Web API Endpoint". The n8n workflow must be **published (active)** for the API to answer.

### 2. Run locally

No build step. Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8080
```

### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or import this GitHub repo in the Vercel dashboard — it deploys as a static site with zero configuration.

## API contract

**Request** `POST {API_URL}`
```json
{ "question": "What does the Quran say about patience?", "sessionId": "optional" }
```

**Response** `200 OK`
```json
{ "answer": "Bismillah... (2:153) ...", "sessionId": "abc-123" }
```

**Errors**
- `400` — missing or empty `question`
- `500` — scholar service error

`sessionId` keeps each visitor's conversation memory. The app stores it in `localStorage` and sends it with every message; omit it to start a fresh conversation.

## Notes

- Answers cite Quran (Surah:Ayah) as the primary source, with authentic Hadith as supplementary support.
- For binding rulings (fatawa), the scholar encourages consulting qualified scholars — it offers guidance, not verdicts.
- CORS is enabled on the endpoint for all origins during development. Restrict it to your Vercel domain in the n8n workflow for production.
