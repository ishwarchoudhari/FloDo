// notifications.js
// Lightweight header notifications with polling and badge update.

(function(){
  // Enforce top padding 6rem when sidebar layout is present
  function ensureContentTopPadding(){
    try {
      const root = document.getElementById('content-root');
      if (!root) return;
      // Sidebar layout indicator: main has md:ml-64 class in this project
      const hasSidebarLayout = root.classList.contains('md:ml-64');
      if (!hasSidebarLayout) return;
      // Only adjust if Tailwind pt-16 is present
      if (!root.classList.contains('pt-16')) return;
      // Inject a scoped override style once
      if (!document.getElementById('contentPaddingOverride')){
        const style = document.createElement('style');
        style.id = 'contentPaddingOverride';
        style.textContent = '#content-root.pt-16{padding-top:6rem !important;}';
        document.head.appendChild(style);
      }
    } catch(_){ }
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ensureContentTopPadding);
  } else {
    ensureContentTopPadding();
  }
  const POLL_MS = 3000; // unified 3s
  const LS_TS_KEY = 'notifLastSeen'; // legacy timestamp-based
  const LS_ID_KEY = 'notifLastSeenId'; // preferred when API returns stable log IDs
  const DEBUG = (typeof window !== 'undefined' && window.DEBUG_NOTIF === true);
  function dlog(){ try { if (DEBUG && typeof console !== 'undefined' && console.debug) console.debug('[notif]', ...arguments); } catch(_){} }

  function qs(id){ return document.getElementById(id); }
  function initials(name){
    if (!name || typeof name !== 'string') return '?';
    return name.trim().charAt(0).toUpperCase();
  }
  function timeAgo(iso){
    try {
      const d = new Date(iso);
      const now = new Date();
      const sec = Math.max(0, Math.floor((now - d) / 1000));
      if (sec < 10) return 'just now';
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min} min ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr} h ago`;
      const day = Math.floor(hr / 24);
      if (day < 7) return `${day} d ago`;
      // fallback to locale for older items
      return d.toLocaleString();
    } catch { return iso; }
  }

  async function fetchRecent(perPage){
    try{
      const nocache = Date.now();
      const res = await fetch(`/dashboard/api/logs/?per_page=${perPage||10}&_=${nocache}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!res.ok){
        try { dlog('fetchRecent non-ok', { status: res.status }); } catch(_){ }
      }
      let data = null;
      try { data = await res.json(); }
      catch(e){ try { dlog('fetchRecent json parse error', e); } catch(_){ } }
      if (!data || !data.success){
        try { dlog('fetchRecent no data or success=false', data); } catch(_){ }
        return [];
      }
      return data.results || [];
    }catch(e){ try { dlog('fetchRecent failed', e); } catch(_){ } return []; }
  }

  function dedupeItems(items){
    if (!Array.isArray(items) || items.length === 0) return [];
    const out = [];
    const seen = new Set();
    // Prefer unique key by stable id; fallback to a composite signature
    for (const it of items){
      const key = (typeof it.id !== 'undefined') ? `id:${it.id}` : `sig:${it.timestamp}|${it.action}|${it.table_name}|${it.row_id}|${it.admin_user}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }

  function ensureNotifStyles(){
    if (document.getElementById('notifGlowStyles')) return;
    const style = document.createElement('style');
    style.id = 'notifGlowStyles';
    style.textContent = `
@keyframes notifPulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.28)}70%{box-shadow:0 0 0 10px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}
@keyframes notifGlowOut{0%{background-color:rgba(59,130,246,0.06)}100%{background-color:transparent}}
.notif-new{background-color:rgba(59,130,246,0.06); animation:notifPulse 1800ms ease-out infinite}
.dark .notif-new{background-color:rgba(59,130,246,0.12)}
.notif-fade{animation:notifGlowOut 600ms ease-out 1}
/* Bell attention/fade visuals (SOC: notifications-only) */
#notifBtn svg{ transition: color 400ms ease, fill 800ms ease, stroke 400ms ease; }
.notif-bell-attn{ color:#FF9B00 !important; }
.notif-bell-attn path{ fill: rgba(255,155,0,0.25) !important; }
@keyframes notifBellFade { 0%{ color:#FF9B00; } 100%{ color:#374151; } }
@keyframes notifBellFillFade { 0%{ fill: rgba(255,155,0,0.25); } 100%{ fill: transparent; } }
.notif-bell-fade{ animation: notifBellFade 1200ms ease forwards; }
.notif-bell-fade path{ animation: notifBellFillFade 1200ms ease forwards; }
`;
    document.head.appendChild(style);
  }

  function renderList(items){
    const list = qs('notifList');
    const empty = qs('notifEmpty');
    if (!list || !empty) return;
    dlog('renderList', { count: (items && items.length) || 0 });
    list.innerHTML = '';
    if (!items.length){
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    ensureNotifStyles();

    // Determine which items are new relative to last seen (prefer ID)
    const last = getLastSeen();
    const newIdSet = new Set();
    if (items.length && typeof items[0].id !== 'undefined' && last.id){
      for (const it of items){
        if (String(it.id) === String(last.id)) break;
        newIdSet.add(String(it.id));
      }
    }

    const now = Date.now();
    items.forEach(it => {
      const li = document.createElement('li');
      const unseenById = (typeof it.id !== 'undefined') ? newIdSet.has(String(it.id)) : false;
      const unseenByTs = (!unseenById && last.ts) ? (it.timestamp > last.ts) : false;
      // Persist pulsing highlight for up to 1 minute after arrival, even if marked as seen
      let withinOneMinute = false;
      try { withinOneMinute = Math.abs(now - new Date(it.timestamp).getTime()) <= 60 * 1000; } catch {}
      const shouldHighlight = withinOneMinute;
      li.className = [
        'p-3 rounded-lg border shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px will-change-transform',
        // Base backgrounds (light + dark)
        'bg-white dark:bg-gray-800',
        // Borders (light + dark)
        'border-gray-200 dark:border-gray-700',
        // Text color (ensure readability in dark)
        'text-gray-900 dark:text-gray-100',
        // Hover backgrounds respecting theme
        'hover:bg-white dark:hover:bg-gray-800',
        shouldHighlight ? 'notif-new' : ''
      ].join(' ').trim();

      const admin = it.admin_user || 'Admin';
      const actionRaw = (it.action || '').toUpperCase();
      const name = it.name || (it.row_details && it.row_details.name) || '';
      const city = it.city || (it.row_details && it.row_details.city) || '';
      const phone = it.phone || (it.row_details && it.row_details.phone) || '';
      const uid = it.row_id;
      const table = (it.table_name || '').toString();
      const statusVal = (it.row_details && (it.row_details.status || it.row_details.application_status)) || '';

      const row = document.createElement('div');
      row.className = 'flex items-start gap-3';

      const avatar = document.createElement('div');
      // Match sidebar avatar size and shape (w-12 h-12) and default bg
      avatar.className = 'w-12 h-12 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm';
      avatar.setAttribute('aria-hidden', 'true');
      if (window.__admin_avatar_url){
        const img = document.createElement('img');
        img.src = window.__admin_avatar_url;
        img.alt = 'Avatar';
        img.loading = 'lazy';
        img.className = 'w-full h-full object-cover';
        avatar.appendChild(img);
      } else {
        // Default SVG avatar (same as sidebar)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'w-8 h-8 text-gray-600');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 20 20');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('d', 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z');
        path.setAttribute('clip-rule', 'evenodd');
        svg.appendChild(path);
        avatar.appendChild(svg);
      }

      const right = document.createElement('div');
      right.className = 'flex-1 min-w-0';

      const line = document.createElement('div');
      line.className = 'text-[0.94rem] leading-5 sm:text-sm whitespace-normal break-words';
      // Special case: Artist Application created (Table6 or humanized label)
      const isArtistApp = (table === 'Table6') || /artist\s*application/i.test(table);
      // Friendly action mapping for Artist Applications (SOC: client-side only)
      const actionMap = {
        CREATE: 'applied',
        UPDATE: 'status updated',
        APPROVE: 'approved',
        REJECT: 'rejected'
      };
      if (isArtistApp && actionRaw === 'CREATE') {
        // "<Name> applied for Artist Application • ID #<uid>" (+optional city/phone bullets)
        const frag = document.createDocumentFragment();
        const nameStrong = document.createElement('span');
        nameStrong.className = 'font-semibold';
        nameStrong.textContent = name || 'Applicant';
        frag.appendChild(nameStrong);
        frag.append(' applied for Artist Application');
        if (uid !== undefined && uid !== null) {
          frag.append(' • ID #');
          const idSpan = document.createElement('span'); idSpan.className = 'font-normal'; idSpan.textContent = String(uid); frag.appendChild(idSpan);
        }
        if (city) { frag.append(' • ' + city); }
        if (phone) { frag.append(' • ' + phone); }
        line.appendChild(frag);
      } else if (isArtistApp && (actionRaw === 'APPROVE' || actionRaw === 'REJECT' || actionRaw === 'UPDATE')) {
        // "<Name>'s application was approved/rejected/updated (to <status>) • ID #<uid>"
        const frag = document.createDocumentFragment();
        // Optional decorative icon for approved/rejected (accessibility: aria-hidden)
        if (actionRaw === 'APPROVE' || actionRaw === 'REJECT') {
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('class', actionRaw === 'APPROVE' ? 'w-4 h-4 text-emerald-600 inline-block align-[-2px] mr-1.5' : 'w-4 h-4 text-rose-600 inline-block align-[-2px] mr-1.5');
          icon.setAttribute('viewBox', '0 0 20 20');
          icon.setAttribute('fill', 'currentColor');
          icon.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          if (actionRaw === 'APPROVE') {
            // check circle
            path.setAttribute('d', 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293A1 1 0 106.293 10.707l2 2a1 1 0 001.414 0l3.999-4z');
          } else {
            // x circle
            path.setAttribute('d', 'M10 18a8 8 0 100-16 8 8 0 000 16zm2.828-10.828a1 1 0 10-1.414-1.414L10 7.172 8.586 5.758a1 1 0 10-1.414 1.414L8.586 8.586 7.172 10a1 1 0 101.414 1.414L10 9.999l1.414 1.415A1 1 0 1012.828 10l-1.414-1.414 1.414-1.414z');
          }
          icon.appendChild(path);
          frag.appendChild(icon);
        }
        const nameStrong = document.createElement('span');
        nameStrong.className = 'font-semibold';
        nameStrong.textContent = name || 'Applicant';
        frag.appendChild(nameStrong);
        frag.append("'s application was ");
        if (actionRaw === 'APPROVE') {
          frag.append('approved');
        } else if (actionRaw === 'REJECT') {
          frag.append('rejected');
        } else {
          // UPDATE
          const statusPretty = (statusVal || '').toString().replace(/_/g,' ').toLowerCase();
          frag.append('updated');
          if (statusPretty) { frag.append(' to ' + statusPretty); }
        }
        if (uid !== undefined && uid !== null) {
          frag.append(' • ID #');
          const idSpan = document.createElement('span'); idSpan.className = 'font-normal'; idSpan.textContent = String(uid); frag.appendChild(idSpan);
        }
        if (city) { frag.append(' • ' + city); }
        if (phone) { frag.append(' • ' + phone); }
        line.appendChild(frag);
      } else {
        // Default: (Admin) has <action> <name> with ID ... from ... with Phone ...
        const action = isArtistApp ? (actionMap[actionRaw] || actionRaw.toLowerCase()) : actionRaw.toLowerCase();
        const frag = document.createDocumentFragment();
        const adminSpan = document.createElement('span'); adminSpan.className = 'font-semibold'; adminSpan.textContent = admin; frag.appendChild(adminSpan);
        frag.append(' has ');
        const actionSpan = document.createElement('span'); actionSpan.className = 'font-normal'; actionSpan.textContent = action; frag.appendChild(actionSpan);
        frag.append(' ');
        const nameSpan = document.createElement('span'); nameSpan.className = 'font-normal'; nameSpan.textContent = (name || '-'); frag.appendChild(nameSpan);
        if (uid !== undefined && uid !== null) {
          frag.append(' with ID ');
          const idSpan = document.createElement('span'); idSpan.className = 'font-normal'; idSpan.textContent = String(uid); frag.appendChild(idSpan);
        }
        if (city) { frag.append(' from '); const citySpan = document.createElement('span'); citySpan.className = 'font-normal'; citySpan.textContent = city; frag.appendChild(citySpan); }
        if (phone) { frag.append(' with Phone '); const phoneSpan = document.createElement('span'); phoneSpan.className = 'font-normal'; phoneSpan.textContent = phone; frag.appendChild(phoneSpan); }
        frag.append('.');
        line.appendChild(frag);
      }

      const meta = document.createElement('div');
      meta.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
      meta.textContent = timeAgo(it.timestamp);

      right.appendChild(line);
      right.appendChild(meta);
      row.appendChild(avatar);
      row.appendChild(right);
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function updateBadge(newCount){
    const badge = qs('notifBadge');
    if (!badge) return;
    dlog('updateBadge', { newCount });
    if (newCount > 0){
      badge.textContent = String(newCount);
      badge.classList.remove('hidden');
      // Visual: highlight bell when there are unseen notifications
      try {
        const bell = document.querySelector('#notifBtn svg');
        if (bell){ bell.classList.add('notif-bell-attn'); bell.classList.remove('notif-bell-fade'); }
      } catch(_){ }
    } else {
      badge.textContent = '';
      badge.classList.add('hidden');
      // Do not immediately strip highlight here; let openMenu trigger a smooth fade when user opens dropdown
    }
  }

  function getLastSeen(){
    try {
      return {
        id: localStorage.getItem(LS_ID_KEY) || '',
        ts: localStorage.getItem(LS_TS_KEY) || ''
      };
    } catch { return { id:'', ts:'' }; }
  }
  function setLastSeenById(id){
    try { localStorage.setItem(LS_ID_KEY, id ? String(id) : ''); } catch {}
  }
  function setLastSeenByTs(ts){
    try { localStorage.setItem(LS_TS_KEY, ts || ''); } catch {}
  }

  // Shared pause flag with tables/logs
  function isPaused(){
    try { return Date.now() <= (window.__autoPauseUntil || window.__tablesPauseUntil || 0); } catch(_) { return false; }
  }

  // Prevent overlapping polls
  if (typeof window.__notifInFlight === 'undefined') window.__notifInFlight = false;

  async function tick(){
    if (isPaused()) { dlog('tick skipped: paused'); return; }
    if (window.__notifInFlight) { dlog('tick skipped: in-flight'); return; }
    window.__notifInFlight = true;
    try {
      const raw = await fetchRecent(10);
      const items = dedupeItems(raw);
      renderList(items);
      const last = getLastSeen();
      let newCount = 0;
      // Prefer ID-based unseen computation if each item has an 'id'
      if (items.length && items[0] && typeof items[0].id !== 'undefined'){
        const lastId = last.id;
        if (lastId){
          // count items before we hit lastId
          for (const it of items){
            if (String(it.id) === String(lastId)) break;
            newCount++;
          }
        } else {
          newCount = items.length;
        }
        // remember latest identifiers for open action
        window.__notif_latest_id = items[0]?.id;
        window.__notif_latest_ts = items[0]?.timestamp;
      } else {
        // Fallback to timestamp logic
        const lastTs = last.ts;
        const newestTs = items[0]?.timestamp || lastTs;
        newCount = lastTs ? items.filter(x => x.timestamp > lastTs).length : items.length;
        window.__notif_latest_ts = newestTs;
        window.__notif_latest_id = undefined;
      }
      updateBadge(newCount);
    } finally {
      // Always clear in-flight guard to keep polling alive
      try { window.__notifInFlight = false; } catch(_){ }
    }
  }

  // Expose a safe immediate bump to fetch notifications now (used after CRUD success)
  window.bumpNotificationsNow = function(){
    try {
      if (isPaused()) return;
      if (window.__notifInFlight) return;
      window.__notifInFlight = true;
      Promise.resolve(tick()).catch(()=>{}).finally(()=>{ try { window.__notifInFlight = false; } catch(_){} });
    } catch(_){ }
  };

  function handleBellClick(){
    const btn = qs('notifBtn');
    const menu = qs('notifMenu');
    if (!btn || !menu) return;
    // Idempotent guard: avoid double-binding which can cause immediate open-then-close
    if (btn.getAttribute('data-notif-bound') === '1') { dlog('bell already bound'); return; }

    // Ensure initial closed state classes for smooth animation
    try {
      if (!menu.classList.contains('is-open') && !menu.classList.contains('is-closed')) {
        menu.classList.add('is-closed');
      }
    } catch(_){ }

    function openMenu(){
      if (menu.classList.contains('is-open') && !menu.classList.contains('hidden')) return;
      dlog('openMenu');
      // Step 1: unhide so transition can play
      menu.classList.remove('hidden');
      // Step 2: next frame, switch to open state for smooth animation
      requestAnimationFrame(()=>{
        menu.classList.add('is-open');
        menu.classList.remove('is-closed');
      });
      try { btn.setAttribute('aria-expanded','true'); } catch(_){ }
      try { window.__notif_menu_opened_at = Date.now(); } catch(_){ }
      const latestId = window.__notif_latest_id;
      const latestTs = window.__notif_latest_ts;
      if (typeof latestId !== 'undefined' && latestId !== null){ setLastSeenById(latestId); }
      if (latestTs){ setLastSeenByTs(latestTs); }
      // Start bell fade-out to original color
      try {
        const bell = document.querySelector('#notifBtn svg');
        if (bell){
          bell.classList.remove('notif-bell-attn');
          // Force reflow to restart animation if needed
          void bell.offsetWidth;
          bell.classList.add('notif-bell-fade');
          // Cleanup after fade completes
          bell.addEventListener('animationend', function onEnd(){
            try { bell.classList.remove('notif-bell-fade'); } catch(_){ }
            bell.removeEventListener('animationend', onEnd);
          });
        }
      } catch(_){ }
      // Badge clears to 0
      updateBadge(0);
    }

    function closeMenu(){
      if (menu.classList.contains('hidden') && !menu.classList.contains('is-open')) return;
      dlog('closeMenu');
      // Switch to closed state for transition, then hide after transition ends
      menu.classList.remove('is-open');
      menu.classList.add('is-closed');
      const TRANSITION_MS = 170; // keep in sync with CSS ~160ms
      setTimeout(()=>{ try { menu.classList.add('hidden'); } catch(_){ } }, TRANSITION_MS);
      try { btn.setAttribute('aria-expanded','false'); } catch(_){ }
    }

    btn.addEventListener('click', (e) => {
      dlog('btn click');
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const willOpen = menu.classList.contains('hidden');
      if (willOpen) { openMenu(); } else { closeMenu(); }
    });

    // Prevent clicks inside menu from closing it
    menu.addEventListener('click', (e) => { e.stopPropagation(); });

    // Close on outside click anywhere in document (ignore clicks on button or within menu)
    if (!window.__notif_doc_bound) {
      document.addEventListener('click', (ev) => {
        try {
          const target = ev.target;
          if (btn.contains(target) || menu.contains(target)) return;
          dlog('outside click -> close');
          closeMenu();
        } catch(_){ }
      });
      window.__notif_doc_bound = true;
    }

    // Close on Escape for accessibility (bind once)
    if (!window.__notif_escape_bound) {
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { closeMenu(); }
      });
      window.__notif_escape_bound = true;
    }

    // Mark as bound
    try { btn.setAttribute('data-notif-bound','1'); } catch(_){ }
  }
    

function __initNotifications(){
  // If header not present (e.g., login page), do nothing
  if (!qs('notifBtn')) return;
  handleBellClick();
  // Global activity listeners to pause auto-refresh while admin is working
  try {
    if (!window.noteGlobalActivity){
      const MAX_PAUSE_MS = 3 * 60 * 1000; // 3 minutes
      window.noteGlobalActivity = function(){
        try {
          const now = Date.now();
          if (typeof window.__autoPauseUntil === 'undefined') window.__autoPauseUntil = 0;
          window.__autoPauseUntil = now + MAX_PAUSE_MS;
          if (window.__tablesInactivityTimer) { clearTimeout(window.__tablesInactivityTimer); window.__tablesInactivityTimer = null; }
        } catch(_){ }
      };
      // Generic input/typing across the app
      document.addEventListener('input', function(e){
        const t = e && e.target;
        if (!t) return;
        if (t.matches && (t.matches('input, textarea, select, [contenteditable="true"]'))) {
          window.noteGlobalActivity();
        }
      });
      // Clicks on common CRUD/action/search buttons
      document.addEventListener('click', function(e){
        const btn = e && e.target && e.target.closest && e.target.closest('button, a');
        if (!btn) return;
        const label = (btn.textContent || '').toLowerCase();
        const hasAction = btn.getAttribute && (btn.getAttribute('data-action') || btn.getAttribute('onclick'));
        if (hasAction || /add|edit|update|delete|save|action|search/.test(label)) {
          window.noteGlobalActivity();
        }
      });
      // Focus into forms also counts as activity
      document.addEventListener('focusin', function(e){
        const t = e && e.target;
        if (!t) return;
        if (t.matches && (t.matches('input, textarea, select, [contenteditable="true"]'))) {
          window.noteGlobalActivity();
        }
      });
    }
  } catch(_){ }

  // Initial tick and interval with pause and race guards
  tick().catch(()=>{}).finally(()=>{ try { window.__notifInFlight = false; } catch(_){} });
  setInterval(function(){ Promise.resolve(tick()).finally(()=>{ /* flag cleared in tick finally */ }); }, POLL_MS);
}

if (!window.__notif_inited) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ if (!window.__notif_inited) { __initNotifications(); window.__notif_inited = true; } });
  } else {
    // DOM is already ready when script is loaded late (scripts at end of body)
    __initNotifications();
    window.__notif_inited = true;
  }
} else {
  dlog('notifications already initialized');
}
})();

// --- Real-time Notifications via WebSocket (additive; falls back to polling) ---
(function(){
  try {
    // Prevent double init
    if (window.__notif_ws_inited) return;
    window.__notif_ws_inited = true;

    const DEBUG = (typeof window !== 'undefined' && window.DEBUG_NOTIF === true);
    function dlog(){ try { if (DEBUG && typeof console !== 'undefined' && console.debug) console.debug('[notif-ws]', ...arguments); } catch(_){} }

    const proto = (location.protocol === 'https:') ? 'wss' : 'ws';
    const endpoint = `${proto}://${location.host}/ws/notifications/`;

    let ws = null;
    let reconnectDelay = 1000; // backoff starts at 1s
    const maxDelay = 20000; // cap at 20s

    function scheduleReconnect(){
      const delay = reconnectDelay;
      reconnectDelay = Math.min(maxDelay, Math.floor(reconnectDelay * 1.8));
      dlog('reconnect in ms', delay);
      setTimeout(connect, delay);
    }

    function connect(){
      try {
        dlog('connecting', endpoint);
        ws = new WebSocket(endpoint);

        ws.onopen = function(){
          dlog('connected');
          reconnectDelay = 1000; // reset backoff
        };

        ws.onmessage = function(evt){
          try {
            const msg = JSON.parse(evt.data || '{}');
            if (msg && msg.type === 'activity_log'){
              // Hint unseen computation and trigger a gentle refresh
              try { window.__notif_latest_ts = (msg.data && msg.data.timestamp) || new Date().toISOString(); } catch(_){ }
              if (typeof window.bumpNotificationsNow === 'function') {
                window.bumpNotificationsNow();
              }
            }
          } catch(e){ dlog('onmessage parse error', e); }
        };

        ws.onerror = function(e){ dlog('ws error', e); };

        ws.onclose = function(){
          dlog('closed');
          // Allow polling to continue; attempt to reconnect in background
          scheduleReconnect();
        };
      } catch(e){
        dlog('connect error', e);
        scheduleReconnect();
      }
    }

    // Kick off connection shortly after load to avoid competing with initial requests
    setTimeout(connect, 250);
  } catch(_){ /* no-op: polling remains active */ }
})();

