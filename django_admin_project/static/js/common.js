// common.js
// Utility helpers shared across the app.

// Get CSRF token from cookie (Django default)
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Toggle dropdowns by id
function toggleDropdown(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.toggle('hidden');
}

// Toast queue and centered placement to avoid overlapping header dropdown
const __toastQueue = [];
let __toastActive = false;

function __getToastContainer(){
  let c = document.getElementById('toastContainer');
  if (!c){
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'fixed top-4 left-0 right-0 z-50 flex justify-center items-start pointer-events-none';
    document.body.appendChild(c);
  }
  return c;
}

function __renderToast(message, type, details){
  let color = 'bg-blue-600';
  let icon = 'ℹ️';
  if (type === 'success') { color = 'bg-green-600'; icon = '✔️'; }
  if (type === 'error') { color = 'bg-red-600'; icon = '⚠️'; }
  const wrapper = document.createElement('div');
  wrapper.className = 'pointer-events-auto';
  const div = document.createElement('div');
  div.setAttribute('role', 'status');
  div.setAttribute('aria-live', 'polite');
  div.className = `${color} text-white px-4 py-3 rounded shadow-lg max-w-sm w-[min(92vw,28rem)]`; // centered card
  div.innerHTML = `
    <div class="flex items-start gap-2">
      <span class="text-lg leading-none">${icon}</span>
      <div class="flex-1">
        <div class="font-medium">${message}</div>
        ${details ? `<div class="opacity-90 text-sm mt-0.5">${details}</div>` : ''}
      </div>
    </div>`;
  // animation
  wrapper.style.transition = 'transform 220ms ease, opacity 220ms ease';
  wrapper.style.transform = 'translateY(-10px)';
  wrapper.style.opacity = '0';
  const container = __getToastContainer();
  container.appendChild(wrapper);
  wrapper.appendChild(div);
  // enter
  requestAnimationFrame(() => {
    wrapper.style.transform = 'translateY(0)';
    wrapper.style.opacity = '1';
  });
  const timeout = setTimeout(() => __dismissToast(wrapper), 3000);
  wrapper.addEventListener('click', () => {
    clearTimeout(timeout);
    __dismissToast(wrapper);
  });
}

function __dismissToast(wrapper){
  wrapper.style.transform = 'translateY(-10px)';
  wrapper.style.opacity = '0';
  setTimeout(() => {
    wrapper.remove();
    __toastActive = false;
    __drainToastQueue();
  }, 220);
}

function __drainToastQueue(){
  if (__toastActive) return;
  const next = __toastQueue.shift();
  if (!next) return;
  __toastActive = true;
  __renderToast(next.message, next.type, next.details);
}

// Simple notification banner with optional details (public API)
function showNotification(message, type = 'info', details = '') {
  __toastQueue.push({ message, type, details });
  __drainToastQueue();
}

window.getCookie = getCookie;
window.toggleDropdown = toggleDropdown;
window.showNotification = showNotification;

// Lightweight global loading indicator (top progress bar)
let __loadingCount = 0;
let __loadingTimer = null;
function __ensureProgressBar(){
  let bar = document.getElementById('globalProgressBar');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'globalProgressBar';
    bar.className = 'fixed top-0 left-0 h-0.5 bg-blue-600 dark:bg-blue-400 z-[60] transition-[width,opacity] duration-300 ease-out';
    bar.style.width = '0%';
    bar.style.opacity = '0';
    document.body.appendChild(bar);
  }
  return bar;
}
function startLoading(){
  const bar = __ensureProgressBar();
  __loadingCount++;
  if (__loadingCount === 1){
    // reset and start animating to 80%
    bar.style.opacity = '1';
    bar.style.width = '0%';
    // small delay to allow CSS to register width reset
    requestAnimationFrame(()=>{
      bar.style.width = '80%';
    });
    // safety timer to avoid hanging bar
    if (__loadingTimer) clearTimeout(__loadingTimer);
    __loadingTimer = setTimeout(()=>{ bar.style.width = '90%'; }, 4000);
  }
}
function stopLoading(){
  const bar = __ensureProgressBar();
  __loadingCount = Math.max(0, __loadingCount - 1);
  if (__loadingCount === 0){
    if (__loadingTimer) { clearTimeout(__loadingTimer); __loadingTimer = null; }
    // finish to 100% then fade out
    bar.style.width = '100%';
    setTimeout(()=>{ bar.style.opacity = '0'; }, 200);
    setTimeout(()=>{ bar.style.width = '0%'; }, 600);
  }
}
async function withLoading(promise){
  try { startLoading(); return await promise; } finally { stopLoading(); }
}

window.startLoading = startLoading;
window.stopLoading = stopLoading;
window.withLoading = withLoading;

// Intercept logout form to use AJAX endpoint and redirect cleanly
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('logoutForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(form.getAttribute('action') || '/logout/', { method: 'POST', headers: { 'X-CSRFToken': getCookie('csrftoken') } });
        const data = await res.json();
        window.location.href = (data && data.redirect) ? data.redirect : '/login/';
      } catch (err) {
        window.location.href = '/login/';
      }
    });
  }
});

// Unique ID generation (5-char alphanumeric) and persistent mapping
function generateUniqueID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function _loadUidMap(){
  try { return JSON.parse(localStorage.getItem('uidMap') || '{}'); } catch { return {}; }
}

function _saveUidMap(map){
  try { localStorage.setItem('uidMap', JSON.stringify(map)); } catch {}
}

// Returns persistent UID for a stable key; generates if missing and guarantees uniqueness within the map
function getPersistentUID(stableKey){
  const map = _loadUidMap();
  if (map[stableKey]) return map[stableKey];
  let candidate = generateUniqueID();
  const values = new Set(Object.values(map));
  while (values.has(candidate)) candidate = generateUniqueID();
  map[stableKey] = candidate;
  _saveUidMap(map);
  return candidate;
}

window.generateUniqueID = generateUniqueID;
window.getPersistentUID = getPersistentUID;


// Wrapper around fetch that injects Django CSRF header for same-origin, non-GET requests
async function fetchWithCSRF(input, init){
  init = init || {};
  const method = (init.method || 'GET').toUpperCase();
  const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'TRACE';
  const url = (typeof input === 'string') ? input : (input && input.url) || '';
  const isSameOrigin = !/^https?:\/\//i.test(url) || url.indexOf(location.origin) === 0;
  if (isSameOrigin && !isSafe){
    init.headers = init.headers || {};
    // Determine token with fallbacks (cookie -> meta[name="csrf-token"] -> #csrf-token-global)
    var token = (function(){
      try { var c = getCookie('csrftoken'); if (c) return c; } catch(_){ }
      try { var m = document.querySelector('meta[name="csrf-token"]'); if (m && (m.content||'').trim()) return m.content.trim(); } catch(_){ }
      try { var h = document.getElementById('csrf-token-global'); if (h && (h.value||h.content)) return (h.value||h.content); } catch(_){ }
      return '';
    })();
    if (!(init.headers instanceof Headers)){
      // Plain object, safe to mutate
      if (!init.headers['X-CSRFToken'] && token) init.headers['X-CSRFToken'] = token;
      if (!init.headers['X-Requested-With']) init.headers['X-Requested-With'] = 'XMLHttpRequest';
    } else {
      if (!init.headers.has('X-CSRFToken') && token) init.headers.set('X-CSRFToken', token);
      if (!init.headers.has('X-Requested-With')) init.headers.set('X-Requested-With', 'XMLHttpRequest');
    }
    init.credentials = init.credentials || 'same-origin';
  }
  return fetch(input, init);
}

window.fetchWithCSRF = fetchWithCSRF;

