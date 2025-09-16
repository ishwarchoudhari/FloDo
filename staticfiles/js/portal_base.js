/*
Client Portal base enhancements (no backend changes)
- Theme toggle (persists to localStorage)
- Mobile menu toggling
- WebSocket notifications indicator (uses existing /ws/notifications/)
- Basic AJAX helper (fetch wrapper) reserved for future use
Security-conscious: no inline eval, no third-party origins beyond existing Tailwind CDN already in templates.
*/
(function () {
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  // Theme toggle
  function setTheme(mode) {
    try {
      if (mode === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', mode);
    } catch (_) {}
  }

  // User dropdown menus (desktop + mobile)
  function initUserMenu(){
    var btn = qs('#user-menu-btn');
    var panel = qs('#user-menu-panel');
    var btnM = qs('#user-menu-btn-mobile');
    var panelM = qs('#user-menu-panel-mobile');
    function toggle(el){ if (!el) return; el.classList.toggle('hidden'); }
    function open(el){ if (!el) return; el.classList.remove('hidden'); }
    function close(el){ if (!el) return; el.classList.add('hidden'); }
    if (btn && panel){
      btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); toggle(panel); btn.setAttribute('aria-expanded', String(!panel.classList.contains('hidden'))); });
    }
    if (btnM && panelM){
      btnM.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); toggle(panelM); btnM.setAttribute('aria-expanded', String(!panelM.classList.contains('hidden'))); });
    }
    document.addEventListener('click', function(e){
      var t = e.target;
      if (panel && !panel.contains(t) && btn && !btn.contains(t)) close(panel);
      if (panelM && !panelM.contains(t) && btnM && !btnM.contains(t)) close(panelM);
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ close(panel); close(panelM); } });
  }
  function currentTheme() {
    try {
      var t = localStorage.getItem('theme');
      if (t === 'dark' || t === 'light') return t;
      // Fallback to media query
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (_) {}
    return 'light';
  }

  function initThemeToggle() {
    var btn = qs('#btn-theme');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      // swap icons
      try {
        qs('#icon-sun') && (qs('#icon-sun').style.display = (next === 'dark' ? '' : 'none'));
        qs('#icon-moon') && (qs('#icon-moon').style.display = (next === 'dark' ? 'none' : ''));
      } catch (_) {}
    });
  }

  // Mobile menu toggle
  function initMobileMenu() {
    var btn = qs('#btn-mobile');
    var menu = qs('#mobile-nav');
    if (!btn || !menu) return;
    btn.addEventListener('click', function () {
      var hidden = menu.classList.contains('hidden');
      if (hidden) menu.classList.remove('hidden'); else menu.classList.add('hidden');
    });
  }

  // WebSocket notifications (Channels routing: /ws/notifications/)
  function initNotifications() {
    var dot = qs('#notif-dot');
    var btn = qs('#btn-bell');
    if (!btn) return;
    var proto = (location.protocol === 'https:') ? 'wss://' : 'ws://';
    var wsUrl = proto + location.host + '/ws/notifications/';
    try {
      var ws = new WebSocket(wsUrl);
      ws.onopen = function () { /* conn ok */ };
      ws.onmessage = function (evt) {
        try {
          var msg = JSON.parse(evt.data);
          // minimal policy: show a dot on any message
          if (dot) dot.classList.remove('hidden');
          // Optional: toast UI could be added; we avoid inline HTML for CSP friendliness
        } catch (_) {
          if (dot) dot.classList.remove('hidden');
        }
      };
      ws.onclose = function () { /* silent */ };
      btn.addEventListener('click', function (e) {
        if (dot) dot.classList.add('hidden');
      });
    } catch (_) {}
  }

  // Minimal fetch helper (CSRF-aware for future POSTs)
  function getCookie(name) {
    var value = '; ' + document.cookie;
    var parts = value.split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
  function ajax(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if ((opts.method || 'GET').toUpperCase() !== 'GET') {
      var csrf = getCookie('csrftoken');
      if (csrf) opts.headers['X-CSRFToken'] = csrf;
    }
    return fetch(url, opts);
  }
  window.PortalAjax = ajax;

  function boot() {
    // Ensure initial theme matches preference
    setTheme(currentTheme());
    initThemeToggle();
    initMobileMenu();
    initNotifications();
    initUserMenu();
    initStickySearch();
    initFiltersDrawer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// --- Portal UX Enhancements ---
(function(){
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function throttle(fn, wait){ let t=0; return function(){ const now=Date.now(); if(now-t>wait){ t=now; return fn.apply(this, arguments);} }; }

  // Sticky compact search: shrink header and emphasize the inline search on scroll
  window.initStickySearch = function(){
    var header = qs('header');
    var compacted = false;
    if(!header) return;
    var onScroll = throttle(function(){
      var y = window.scrollY || window.pageYOffset || 0;
      if (y > 80 && !compacted) {
        compacted = true;
        header.classList.add('shadow-lg');
      } else if (y <= 80 && compacted) {
        compacted = false;
        header.classList.remove('shadow-lg');
      }
    }, 100);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Filters drawer toggle on Browse Artists
  window.initFiltersDrawer = function(){
    var btn = qs('#btn-filters');
    var drawer = qs('#filters-drawer');
    if(!btn || !drawer) return;
    btn.addEventListener('click', function(){
      drawer.classList.toggle('hidden');
    });
  }
})();

// --- Toast Notifications for WebSocket messages ---
(function(){
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function makeToastContainer(){
    var el = document.getElementById('toast-root');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'toast-root';
    el.style.position = 'fixed';
    el.style.right = '1rem';
    el.style.bottom = '1rem';
    el.style.zIndex = '9999';
    document.body.appendChild(el);
    return el;
  }
  function toast(msg){
    var root = makeToastContainer();
    var card = document.createElement('div');
    card.className = 'mb-2 px-4 py-3 rounded-lg text-sm text-white shadow-lg bg-gradient-to-tr from-pink-600 to-fuchsia-600 opacity-0 translate-y-2 transition duration-300';
    card.textContent = msg || 'Notification';
    root.appendChild(card);
    requestAnimationFrame(function(){ card.classList.remove('opacity-0','translate-y-2'); });
    setTimeout(function(){ card.classList.add('opacity-0','translate-y-2'); setTimeout(function(){ card.remove(); }, 300); }, 4000);
  }
  // Hook into existing WebSocket handler by monkey-patching after initNotifications sets ws
  var _oldInit = window.initNotifications;
  window.initNotifications = function(){
    var dot = qs('#notif-dot');
    var btn = qs('#btn-bell');
    var proto = (location.protocol === 'https:') ? 'wss://' : 'ws://';
    var wsUrl = proto + location.host + '/ws/notifications/';
    try {
      var ws = new WebSocket(wsUrl);
      ws.onmessage = function (evt) {
        try { var msg = JSON.parse(evt.data); toast(msg.title || 'Update'); } catch (e) { toast('Update'); }
        if (dot) dot.classList.remove('hidden');
      };
      ws.onopen = function(){}; ws.onclose=function(){};
      if (btn) btn.addEventListener('click', function(){ if(dot) dot.classList.add('hidden'); });
    } catch (_) {}
  }
})();
