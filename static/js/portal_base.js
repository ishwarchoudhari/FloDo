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
      updateThemeIcons(mode);
    } catch (_) {}
  }

  function updateThemeIcons(mode){
    try {
      var isDark = mode ? (mode === 'dark') : document.documentElement.classList.contains('dark');
      var sun = qs('#icon-sun');
      var moon = qs('#icon-moon');
      var sunM = qs('#icon-sun-mobile');
      var moonM = qs('#icon-moon-mobile');
      if (sun) sun.style.display = isDark ? '' : 'none';
      if (moon) moon.style.display = isDark ? 'none' : '';
      if (sunM) sunM.style.display = isDark ? '' : 'none';
      if (moonM) moonM.style.display = isDark ? 'none' : '';
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
    var buttons = [qs('#btn-theme'), qs('#btn-theme-mobile')].filter(Boolean);
    if (!buttons.length) return;
    buttons.forEach(function(btn){
      btn.addEventListener('click', function () {
        var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        setTheme(next);
      });
    });
  }

  // Mobile menu toggle
  function initMobileMenu() {
    var btn = qs('#btn-mobile');
    var menu = qs('#mobile-nav');
    if (!btn || !menu) return;
    btn.addEventListener('click', function () {
      var willOpen = menu.classList.contains('hidden');
      if (willOpen) menu.classList.remove('hidden'); else menu.classList.add('hidden');
      try { btn.setAttribute('aria-expanded', String(willOpen)); } catch (_) {}
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
    updateThemeIcons();
    initThemeToggle();
    initMobileMenu();
    initNotifications();
    initUserMenu();
    initStickySearch();
    initFiltersDrawer();
    initAjaxNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// --- AJAX Navigation (PJAX-style) ---
(function(){
  if (window.initAjaxNavigation) return; // avoid redefining
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  // Tiny top progress bar -------------------------------------------------
  var progressEl; var progressTimer;
  function ensureProgressEl(){
    if (progressEl) return progressEl;
    progressEl = document.createElement('div');
    progressEl.id = 'ajax-progress';
    Object.assign(progressEl.style, {
      position: 'fixed', top: '0', left: '0', width: '0%', height: '2px',
      background: 'linear-gradient(90deg,#10b981,#22d3ee,#a78bfa)',
      boxShadow: '0 0 8px rgba(16,185,129,.6)', zIndex: '99999',
      transition: 'width .2s ease, opacity .2s ease', opacity: '0'
    });
    document.body.appendChild(progressEl);
    return progressEl;
  }
  function showProgress(){ ensureProgressEl(); progressEl.style.opacity = '1'; setProgress(5); if (progressTimer) clearInterval(progressTimer); progressTimer = setInterval(function(){ var cur = parseFloat(progressEl.style.width)||0; if (cur < 90) setProgress(cur + Math.max(1, (90-cur)*0.05)); }, 200); }
  function setProgress(p){ ensureProgressEl(); progressEl.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function hideProgress(){ if (!progressEl) return; setProgress(100); setTimeout(function(){ progressEl.style.opacity = '0'; progressEl.style.width = '0%'; if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }, 250); }

  function sameOrigin(url){
    try { var u = new URL(url, location.href); return u.origin === location.origin; } catch(_) { return false; }
  }
  function shouldHandleClick(e){
    if (e.defaultPrevented) return false;
    if (e.button !== 0) return false; // left click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    var a = e.target.closest('a');
    if (!a) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return false;
    if (a.hasAttribute('download') || a.getAttribute('rel') === 'external') return false;
    if (a.dataset.noAjax === 'true') return false;
    if (!sameOrigin(href)) return false;
    return true;
  }

  function showLoading(){ document.body.setAttribute('aria-busy', 'true'); document.documentElement.style.cursor = 'progress'; }
  function hideLoading(){ document.body.removeAttribute('aria-busy'); document.documentElement.style.cursor = ''; }

  function swapContent(doc){
    var newMain = doc.querySelector('#content-root');
    var curMain = qs('#content-root');
    if (!newMain || !curMain) return false;
    curMain.innerHTML = newMain.innerHTML;
    // Execute inline scripts within swapped content (needed for page-local initializers)
    try {
      var scripts = Array.from(curMain.querySelectorAll('script'));
      scripts.forEach(function(old){
        var s = document.createElement('script');
        // Copy attributes (type, nonce, etc.)
        for (var i = 0; i < old.attributes.length; i++) {
          var a = old.attributes[i];
          try { s.setAttribute(a.name, a.value); } catch(_){}
        }
        s.textContent = old.textContent || '';
        // Append to body to execute. CSP nonce (if present) will regulate execution.
        document.body.appendChild(s);
        // Optionally remove afterwards to avoid clutter
        setTimeout(function(){ try { s.remove(); } catch(_){} }, 0);
      });
    } catch(_) {}
    try {
      curMain.classList.add('pjax-fade');
      curMain.addEventListener('animationend', function handler(){
        curMain.classList.remove('pjax-fade');
        curMain.removeEventListener('animationend', handler);
      }, { once: true });
    } catch(_) {}
    var newTitle = doc.querySelector('title');
    if (newTitle) document.title = newTitle.textContent;
    try {
      window.initStickySearch && window.initStickySearch();
      window.initFiltersDrawer && window.initFiltersDrawer();
      if (typeof initUserMenu === 'function') { initUserMenu(); }
      if (typeof updateThemeIcons === 'function') { updateThemeIcons(); }
      // Re-init page-specific scripts (e.g., client auth tabs)
      if (typeof window.initAuthPage === 'function') { window.initAuthPage(); }
      if (typeof window.initStandaloneSignup === 'function') { window.initStandaloneSignup(); }
    } catch(_) {}
    return true;
  }

  function fetchAndSwap(url, push){
    showLoading(); showProgress();
    return fetch(url, { headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' })
      .then(function(res){ if (!res.ok) throw new Error('HTTP '+res.status); return res.text(); })
      .then(function(html){
        var doc = new DOMParser().parseFromString(html, 'text/html');
        if (!swapContent(doc)) { location.href = url; return; }
        if (push) history.pushState({ url: url }, '', url);
      })
      .catch(function(){ location.href = url; })
      .finally(function(){ hideLoading(); hideProgress(); });
  }

  function onClick(e){
    if (!shouldHandleClick(e)) return;
    var a = e.target.closest('a');
    var url = new URL(a.getAttribute('href'), location.href).toString();
    e.preventDefault();
    fetchAndSwap(url, true);
  }
  function onPopState(){ fetchAndSwap(location.href, false); }

  window.initAjaxNavigation = function(){
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
  };
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

// --- Auth Page (Portal) toggles: show signup without full reload ---
(function(){
  if (window.initAuthPage) return; // avoid redefining if provided elsewhere
  function q(sel){ return document.querySelector(sel); }
  function qa(sel){ return Array.from(document.querySelectorAll(sel)); }
  function show(el){ if (el) el.classList.remove('hidden'); }
  function hide(el){ if (el) el.classList.add('hidden'); }
  function setExpanded(el, v){ try { if (el) el.setAttribute('aria-expanded', String(!!v)); } catch(_){} }
  function ensureCloseBtn(host){
    try {
      if (!host) return;
      var existing = host.querySelector('[data-auth-close]');
      if (existing) return existing;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-auth-close','1');
      btn.setAttribute('aria-label','Close');
      btn.className = 'absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-white/70 dark:bg-black/40 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-black shadow-sm';
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
      // Positioning context
      try { var style = window.getComputedStyle(host); if (style && style.position === 'static') host.style.position = 'relative'; } catch(_){ }
      btn.addEventListener('click', function(){ hide(host); var other = host === loginPanel ? signupPanel : loginPanel; if (other) hide(other); });
      host.appendChild(btn);
      return btn;
    } catch(_){}
  }

  window.initAuthPage = function(){
    // Try multiple common selectors so we don't depend on exact markup
    var loginPanel = q('[data-login-panel]') || q('#login-panel') || q('#loginFormWrap') || q('#login');
    var signupPanel = q('[data-signup-panel]') || q('#signup-panel') || q('#signupFormWrap') || q('#signup');
    var toSignupBtns = qa('[data-action="show-signup"], #create-account, .js-create-account, [href="#signup"]');
    var toLoginBtns = qa('[data-action="show-login"], #back-to-login, .js-back-login, [href="#login"]');

    if (!loginPanel && !signupPanel) return; // nothing to do on non-auth pages

    function toggleCreateCtas(hideCtas){
      try { toSignupBtns.forEach(function(b){ if (hideCtas) b.classList.add('hidden'); else b.classList.remove('hidden'); }); } catch(_){}
    }
    function toggleLoginCtas(hideCtas){
      try { toLoginBtns.forEach(function(b){ if (hideCtas) b.classList.add('hidden'); else b.classList.remove('hidden'); }); } catch(_){}
    }
    function showSignup(e){ if (e) e.preventDefault(); hide(loginPanel); show(signupPanel); setExpanded(signupPanel, true); setExpanded(loginPanel, false); toggleCreateCtas(true); toggleLoginCtas(false); ensureCloseBtn(signupPanel); }
    function showLogin(e){ if (e) e.preventDefault(); hide(signupPanel); show(loginPanel); setExpanded(loginPanel, true); setExpanded(signupPanel, false); toggleCreateCtas(false); toggleLoginCtas(true); ensureCloseBtn(loginPanel); }

    toSignupBtns.forEach(function(btn){ btn.addEventListener('click', showSignup); });
    toLoginBtns.forEach(function(btn){ btn.addEventListener('click', showLogin); });

    // If URL hash indicates desired panel, honor it without reload
    try {
      if (location.hash === '#signup') showSignup();
      else if (location.hash === '#login') showLogin();
      else {
        // default state: if signup hidden by default
        toggleCreateCtas(false); // show create-account
        toggleLoginCtas(true);   // hide login/switch-to-login CTAs since login is visible
        ensureCloseBtn(loginPanel||signupPanel);
      }
    } catch(_){ toggleCreateCtas(false); toggleLoginCtas(true); }
  };

  // Auto-run on DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.initAuthPage); else window.initAuthPage();
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
        var msg;
        try { msg = JSON.parse(evt.data||'{}'); } catch(e){ msg = {}; }
        try { toast((msg && msg.title) || 'Update'); } catch(_) { toast('Update'); }
        if (dot) dot.classList.remove('hidden');
        // Reapply toggle real-time handler: check availability and navigate if permitted
        try {
          if (msg && msg.payload && msg.payload.event === 'reapply_toggle'){
            fetch('/portal/api/can-apply/', { credentials: 'same-origin' })
              .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
              .then(function(data){
                if (!data || !data.ok) return;
                var can = !!data.can_apply;
                var path = location.pathname || '';
                var onStatus = path.indexOf('/portal/artist/application-status') !== -1;
                var onApply = path.indexOf('/portal/artist/apply') !== -1;
                try { Array.prototype.forEach.call(document.querySelectorAll('#badge-reapply'), function(el){ if (can) el.classList.remove('invisible'); else el.classList.add('invisible'); }); } catch(_){}
                if (can && onStatus){
                  // Inform and navigate to apply form
                  try { toast('You may reapply now.'); } catch(_){ }
                  location.assign('/portal/artist/apply/');
                } else if (!can && onApply){
                  // If suddenly disallowed, send to status page
                  location.assign('/portal/artist/application-status/');
                }
              })
              .catch(function(){ /* ignore */ });
          }
        } catch(_){ }
      };
      ws.onopen = function(){}; ws.onclose=function(){};
      if (btn) btn.addEventListener('click', function(){ if(dot) dot.classList.add('hidden'); });
    } catch (_) {}
  }
})();
