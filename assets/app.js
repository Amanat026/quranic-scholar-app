/* Quranic Guidance Scholar — bilingual chat + voice (English & Bangla)
 * Talks to the Vercel serverless backend at /api/ask (Gemini).
 * Voice input uses the browser Web Speech API (no extra API key).
 */

const API_URL = 'api/ask';

const chat = document.getElementById('chat');
const composer = document.getElementById('composer');
const input = document.getElementById('question');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const stopMicBtn = document.getElementById('stop-mic');
const recBanner = document.getElementById('recording-banner');
const recText = document.getElementById('recording-text');
const langEnBtn = document.getElementById('lang-en');
const langBnBtn = document.getElementById('lang-bn');
const hintText = document.getElementById('hint-text');
const welcomeMsg = document.getElementById('welcome-msg');

const HISTORY_KEY = 'quran_scholar_history';
const LANG_KEY = 'quran_scholar_lang';
const MAX_HISTORY = 10;

const STRINGS = {
  en: {
    title: 'Quranic Guidance Scholar',
    subtitle: 'Ask anything — answered with Quran & wisdom',
    placeholder: 'Ask your question…',
    hints: [
      'Drop your question in the message box.',
      'Ask about prayer, patience, decisions, or daily life…',
      'Every answer is grounded in the Holy Quran.',
      'Type or tap the mic to speak your question.',
    ],
    listening: 'Listening… speak now',
    micUnsupported: 'Voice input is not supported in this browser. Please type your question instead.',
    micDenied: 'Microphone access was denied. Please allow the microphone or type your question.',
    emptyVoice: 'I could not hear anything. Please try again.',
    connectionError: 'Something went wrong. Please check your connection and try again.',
    rateLimited: 'The scholar is receiving many questions right now. Please wait a moment and try again.',
  },
  bn: {
    title: 'কুরআনিক দিকনির্দেশনা আলেম',
    subtitle: 'যেকোনো প্রশ্ন করুন — কুরআন ও জ্ঞানের আলোকে উত্তর পান',
    placeholder: 'আপনার প্রশ্ন লিখুন…',
    hints: [
      'মেসেজ বক্সে আপনার প্রশ্নটি লিখুন।',
      'নামাজ, ধৈর্য, সিদ্ধান্ত বা দৈনন্দিন জীবন নিয়ে জিজ্ঞাসা করুন…',
      'প্রতিটি উত্তর পবিত্র কুরআনের আলোকে দেওয়া হয়।',
      'টাইপ করুন অথবা মাইকে চাপ দিয়ে বলুন।',
    ],
    listening: 'শুনছি… এখন বলুন',
    micUnsupported: 'এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয়। অনুগ্রহ করে আপনার প্রশ্নটি টাইপ করুন।',
    micDenied: 'মাইক্রোফোন ব্যবহারের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে মাইক্রোফোন চালু করুন অথবা টাইপ করুন।',
    emptyVoice: 'আমি কিছু শুনতে পাইনি। আবার চেষ্টা করুন।',
    connectionError: 'কিছু ভুল হয়েছে। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
    rateLimited: 'এই মুহূর্তে অনেক প্রশ্ন আসছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।',
  },
};

/* Rotating welcome message — Bangla first, then English, looping */
const WELCOME_MESSAGES = [
  'আসসালামু আলাইকুম। আমি আমানত উল্লাহর গাইডেন্স স্কলার। পবিত্র কোরআন ও প্রজ্ঞার আলো থেকে আপনার যেকোনো কর্ম, সমস্যা, সিদ্ধান্ত বা নৈতিক প্রশ্নের উত্তর দিতে আমি এখানে প্রস্তুত আছি। আপনি ইংরেজি বা বাংলায় লিখে কিংবা কথা বলে প্রশ্ন করতে পারেন। আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
  "Assalamu alaikum. I am Amanat Ullah's Guidance Scholar, here to offer guidance from the Holy Quran — on any action, problem, decision, or moral question. You may write or speak in English or Bangla. How may I help you today?",
];
const WELCOME_INTERVAL_MS = 5000;
const WELCOME_FADE_MS = 450;

let welcomeTimer = null;

function startWelcomeRotation() {
  if (!welcomeMsg) return;
  if (welcomeTimer) {
    clearInterval(welcomeTimer);
    welcomeTimer = null;
  }
  let idx = 0; // Bangla first
  welcomeMsg.style.opacity = '1';
  welcomeMsg.textContent = WELCOME_MESSAGES[idx];

  welcomeTimer = setInterval(() => {
    idx = (idx + 1) % WELCOME_MESSAGES.length;
    const next = WELCOME_MESSAGES[idx];
    welcomeMsg.style.opacity = '0';
    setTimeout(() => {
      welcomeMsg.textContent = next;
      welcomeMsg.style.opacity = '1';
    }, WELCOME_FADE_MS);
  }, WELCOME_INTERVAL_MS);
}

let currentLang = localStorage.getItem(LANG_KEY) || 'en';

function t(key) {
  return STRINGS[currentLang][key] || STRINGS.en[key];
}

/* ---------- Live rotating hint line (typewriter) ---------- */

let hintTimer = null;

function startHints() {
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }
  const phrases = t('hints');
  let phraseIdx = 0;
  let charIdx = 0;
  let deleting = false;

  function tick() {
    const phrase = phrases[phraseIdx];
    if (!deleting) {
      charIdx++;
      if (charIdx >= phrase.length) {
        charIdx = phrase.length;
        deleting = true;
        hintText.textContent = phrase;
        hintTimer = setTimeout(tick, 2600); // pause on full line
        return;
      }
    } else {
      charIdx--;
      if (charIdx <= 0) {
        charIdx = 0;
        deleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
      }
    }
    hintText.textContent = phrases[phraseIdx].slice(0, charIdx);
    hintTimer = setTimeout(tick, deleting ? 28 : 55);
  }

  tick();
}

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  document.getElementById('app-title').textContent = t('title');
  document.getElementById('app-subtitle').textContent = t('subtitle');
  input.placeholder = t('placeholder');
  recText.textContent = t('listening');
  langEnBtn.classList.toggle('active', lang === 'en');
  langBnBtn.classList.toggle('active', lang === 'bn');
  startHints();
}

langEnBtn.addEventListener('click', () => applyLang('en'));
langBnBtn.addEventListener('click', () => applyLang('bn'));
applyLang(currentLang);
startWelcomeRotation();

/* ---------- Conversation history (browser-side memory) ---------- */

function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function pushHistory(role, text) {
  const history = getHistory();
  history.push({ role, text: text.slice(0, 4000) });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
}

/* ---------- Chat UI ---------- */

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function addMessage(text, role, isError = false) {
  const wrap = document.createElement('div');
  wrap.className = 'message ' + role;
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (isError ? ' error' : '');
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant';
  wrap.id = 'typing-indicator';
  const t = document.createElement('div');
  t.className = 'typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  wrap.appendChild(t);
  chat.appendChild(wrap);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

/* ---------- API ---------- */

async function askScholar(question) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history: getHistory() }),
  });

  let data = {};
  try { data = await res.json(); } catch (_) { /* non-JSON body */ }

  if (!res.ok) {
    if (res.status === 429) throw new Error(t('rateLimited'));
    throw new Error(data.error || t('connectionError'));
  }
  if (!data.answer) {
    throw new Error(t('connectionError'));
  }
  return data.answer;
}

async function sendQuestion(question) {
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  addMessage(question, 'user');
  showTyping();

  try {
    const answer = await askScholar(question);
    hideTyping();
    addMessage(answer, 'assistant');
    pushHistory('user', question);
    pushHistory('assistant', answer);
  } catch (err) {
    hideTyping();
    addMessage(err.message || t('connectionError'), 'assistant', true);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (question) sendQuestion(question);
});

/* ---------- Voice input (Web Speech API) ---------- */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

function speechLang() {
  return currentLang === 'bn' ? 'bn-BD' : 'en-US';
}

function startRecording() {
  if (!SpeechRecognition) {
    addMessage(t('micUnsupported'), 'assistant', true);
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = speechLang();
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    recText.textContent = t('listening');
    recBanner.classList.remove('hidden');
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    input.value = (finalTranscript + ' ' + interim).trim();
  };

  recognition.onerror = (event) => {
    stopRecordingUI();
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      addMessage(t('micDenied'), 'assistant', true);
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      addMessage(t('connectionError'), 'assistant', true);
    }
  };

  recognition.onend = () => {
    const spoken = input.value.trim();
    stopRecordingUI();
    if (spoken) {
      sendQuestion(spoken);
    } else if (isRecording) {
      addMessage(t('emptyVoice'), 'assistant', true);
    }
  };

  try {
    recognition.start();
  } catch (_) {
    stopRecordingUI();
  }
}

function stopRecordingUI() {
  isRecording = false;
  micBtn.classList.remove('recording');
  recBanner.classList.add('hidden');
}

micBtn.addEventListener('click', () => {
  if (isRecording && recognition) {
    recognition.stop();
  } else {
    startRecording();
  }
});

stopMicBtn.addEventListener('click', () => {
  if (recognition) recognition.stop();
});
