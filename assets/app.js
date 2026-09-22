/* Quranic Guidance Scholar — chat logic
 * Talks to the n8n "Quranic Scholar — Web API Endpoint" workflow.
 */

const API_URL = 'https://amanat26.app.n8n.cloud/webhook/quran-scholar';

const chat = document.getElementById('chat');
const composer = document.getElementById('composer');
const input = document.getElementById('question');
const sendBtn = document.getElementById('send');

const SESSION_KEY = 'quran_scholar_session_id';

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function setSessionId(id) {
  if (id) localStorage.setItem(SESSION_KEY, id);
}

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
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

async function askScholar(question) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, sessionId: getSessionId() }),
  });

  let data = {};
  try { data = await res.json(); } catch (_) { /* non-JSON body */ }

  if (data.sessionId) setSessionId(data.sessionId);

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  if (!data.answer) {
    throw new Error('The scholar returned an empty answer. Please try again.');
  }
  return data.answer;
}

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  addMessage(question, 'user');
  showTyping();

  try {
    const answer = await askScholar(question);
    hideTyping();
    addMessage(answer, 'assistant');
  } catch (err) {
    hideTyping();
    addMessage(
      err.message || 'Something went wrong. Please check your connection and try again.',
      'assistant',
      true
    );
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
});
