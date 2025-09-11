'use strict';

// ---- Theme (dark mode) handling with persistence and system preference ----
(function(){
  function getPreferredTheme(){
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch(_){}
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch(_) { return 'light'; }
  }
  function applyTheme(theme){
    try {
      const root = document.documentElement; // <html>
      const body = document.body;            // <body>
      if (theme === 'dark') {
        root.classList.add('dark');
        try { root.setAttribute('data-theme', 'dark'); } catch(_){ }
        if (body) body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        try { root.setAttribute('data-theme', 'light'); } catch(_){ }
        if (body) body.classList.remove('dark');
      }
      const btn = document.getElementById('themeToggle');
      if (btn) {
        btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        const sun = btn.querySelector('[data-icon="sun"]');
        const moon = btn.querySelector('[data-icon="moon"]');
        if (sun && moon){
          if (theme === 'dark'){ sun.classList.remove('hidden'); moon.classList.add('hidden'); }
          else { sun.classList.add('hidden'); moon.classList.remove('hidden'); }
        }
      }
    } catch(_){}
  }
  function setTheme(theme){
    try { localStorage.setItem('theme', theme); } catch(_){ }
    try {
      // Persist for server-rendered initial class in templates/base.html
      // 31536000s ≈ 365 days
      document.cookie = 'theme=' + encodeURIComponent(theme) + '; Path=/; Max-Age=31536000';
    } catch(_){ }
    applyTheme(theme);
  }
  // Initialize on load
  const theme = getPreferredTheme();
  applyTheme(theme);
  // Watch system preference changes if user hasn't chosen explicitly
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql && typeof mql.addEventListener === 'function'){
      mql.addEventListener('change', (e)=>{
        try {
          const stored = localStorage.getItem('theme');
          if (stored !== 'dark' && stored !== 'light') applyTheme(e.matches ? 'dark' : 'light');
        } catch(_){}
      });
    }
  } catch(_){}
  // Expose small API
  window.__setTheme = setTheme;
})();

// Ensure Admin Overview initializes on pages that include the container
(function(){
  function init() {
    try { if (typeof window.initAdminOverview === 'function') window.initAdminOverview(); } catch(_){ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Helper to update aria-live status text
window.updateAriaStatus = function(msg){
  var el = document.getElementById('aria-status');
  if (el) el.textContent = msg || '';
};

// Optional WebSocket to keep dashboard charts live using existing notifications WS
window.initDashboardStatsWS = function(){
  try {
    if (window.__dashWS && (window.__dashWS.readyState === 0 || window.__dashWS.readyState === 1)) return;
    var proto = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
    var url = proto + window.location.host + '/ws/notifications/';
    var ws = new WebSocket(url);
    window.__dashWS = ws;
    ws.onopen = function(){ /* connected */ };
    ws.onmessage = function(ev){
      try {
        var msg = JSON.parse(ev.data||'{}');
        // Any activity implies potential table count change; refresh lightweightly
        if (typeof window.refreshDashboardCharts === 'function') window.refreshDashboardCharts();
      } catch(_){ }
    };
    ws.onclose = function(){
      // Reconnect with small backoff
      setTimeout(function(){ try { window.initDashboardStatsWS(); } catch(_){ } }, 2500);
    };
    ws.onerror = function(){ try { ws.close(); } catch(_){ } };
  } catch(_){ }
};

// ------------------ Dashboard Chart (Table Distribution) ------------------
// Inline SVG bar chart: reads stats from #chart-table-distribution[data-stats]
// Dark-mode aware, responsive, with a lightweight refresh hook.
window.__dashboardChart = null;
window.initDashboardCharts = function(){
  try {
    var host = document.getElementById('chart-table-distribution'); if (!host) return;
    function parseStats(){
      try { return JSON.parse(host.getAttribute('data-stats')||'[]') || []; }
      catch(_){ return []; }
    }
    function theme(){
      var isDark = document.documentElement.classList.contains('dark');
      return isDark ? {
        bg: 'transparent', axis: '#9CA3AF', grid: '#374151', bar:'#60A5FA', text:'#E5E7EB'
      } : {
        bg: 'transparent', axis: '#6B7280', grid: '#E5E7EB', bar:'#2563EB', text:'#111827'
      };
    }
    function clear(){ host.innerHTML=''; }
    function render(){
      var data = parseStats(); if (!data || !data.length){ host.innerHTML = '<div class="text-sm text-gray-500 dark:text-gray-400">No data</div>'; return; }
      clear();
      var rect = host.getBoundingClientRect();
      var width = Math.max(300, Math.floor(rect.width));
      var height = Math.max(220, Math.floor(rect.height));
      var pad = { t: 18, r: 12, b: 36, l: 110 };
      var innerW = width - pad.l - pad.r, innerH = height - pad.t - pad.b;
      var labels = data.map(function(d){ return String(d.label||''); });
      var values = data.map(function(d){ return Math.max(0, Number(d.count)||0); });
      var max = Math.max.apply(null, values.concat([1]));
      // SVG root
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 '+width+' '+height);
      svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
      var g = document.createElementNS(svg.namespaceURI,'g'); g.setAttribute('transform','translate('+pad.l+','+pad.t+')');
      // Grid lines
      var cols = 4; var th = theme();
      for (var i=0;i<=cols;i++){
        var x = Math.round(innerW * i / cols);
        var gl = document.createElementNS(svg.namespaceURI,'line');
        gl.setAttribute('x1', x); gl.setAttribute('y1', 0);
        gl.setAttribute('x2', x); gl.setAttribute('y2', innerH);
        gl.setAttribute('stroke', th.grid); gl.setAttribute('stroke-width','1'); gl.setAttribute('opacity','0.6');
        g.appendChild(gl);
      }
      // Bars
      var barGap = 10; var barH = Math.floor((innerH - barGap*(labels.length-1)) / labels.length);
      for (var j=0;j<labels.length;j++){
        var v = values[j]; var w = Math.round((v / max) * innerW);
        var y = j * (barH + barGap);
        var rectBar = document.createElementNS(svg.namespaceURI,'rect');
        rectBar.setAttribute('x','0'); rectBar.setAttribute('y', String(y));
        rectBar.setAttribute('width', String(Math.max(1,w)));
        rectBar.setAttribute('height', String(barH));
        rectBar.setAttribute('rx','6'); rectBar.setAttribute('ry','6');
        rectBar.setAttribute('fill', th.bar);
        rectBar.setAttribute('class','transition-all duration-200');
        g.appendChild(rectBar);
        // Label
        var txt = document.createElementNS(svg.namespaceURI,'text');
        txt.setAttribute('x', String(-8)); txt.setAttribute('y', String(y + barH/2 + 4));
        txt.setAttribute('text-anchor','end'); txt.setAttribute('fill', th.text);
        txt.setAttribute('font-size','12'); txt.textContent = labels[j]; g.appendChild(txt);
        // Value
        var val = document.createElementNS(svg.namespaceURI,'text');
        val.setAttribute('x', String(Math.max(12,w + 6)));
        val.setAttribute('y', String(y + barH/2 + 4));
        val.setAttribute('fill', th.text); val.setAttribute('font-size','12');
        val.textContent = values[j]; g.appendChild(val);
      }
      svg.appendChild(g); host.appendChild(svg);
    }
    function onResize(){ if (window.__dashboardChartRaf) cancelAnimationFrame(window.__dashboardChartRaf); window.__dashboardChartRaf = requestAnimationFrame(render); }
    window.__dashboardChart = { render: render };
    render();
    window.addEventListener('resize', onResize);
    // Re-render when theme toggles via __setTheme
    try {
      var _origSetTheme = window.__setTheme;
      if (_origSetTheme && !_origSetTheme._patchedForChart){
        window.__setTheme = function(mode){ _origSetTheme(mode); try { window.__dashboardChart && window.__dashboardChart.render(); } catch(_){ } };
        window.__setTheme._patchedForChart = true;
      }
    } catch(_){ }
  } catch(_){ }
};

// Optional refresh: tries a lightweight JSON endpoint if available, else re-renders current data
window.refreshDashboardCharts = async function(){
  try {
    var host = document.getElementById('chart-table-distribution'); if (!host) return;
    // Attempt to fetch fresh distribution; if 404 or error, just re-render current
    try {
      var res = await fetch('/dashboard/api/stats/table_distribution/', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (res.ok){
        var json = await res.json();
        if (Array.isArray(json)){
          host.setAttribute('data-stats', JSON.stringify(json));
        } else if (json && Array.isArray(json.results)){
          host.setAttribute('data-stats', JSON.stringify(json.results));
        }
      }
    } catch(_){ }
    // Keep donut cards dataset in sync (fallback to the same stats)
    try {
      var donuts = document.getElementById('donut-cards');
      if (donuts && host){ donuts.setAttribute('data-stats', host.getAttribute('data-stats') || '[]'); }
    } catch(_){ }
    if (window.__dashboardChart) window.__dashboardChart.render();
    if (window.__dashboardDonuts && typeof window.__dashboardDonuts.render === 'function') window.__dashboardDonuts.render();
  } catch(_){ }
};

// ------------------ Dashboard Donut Charts (Users, Artists, Bookings) ------------------
// Reads stats from #donut-cards[data-stats] and renders three donut charts inline.
window.__dashboardDonuts = null;
window.initDashboardDonuts = function(){
  try {
    var wrapper = document.getElementById('donut-cards'); if (!wrapper) return;
    function parseStats(){ try { return JSON.parse(wrapper.getAttribute('data-stats')||'[]')||[]; } catch(_){ return []; } }
    function theme(){
      var isDark = document.documentElement.classList.contains('dark');
      return isDark ? { text:'#E5E7EB', track:'#374151', users:'#60A5FA', artists:'#34D399', bookings:'#FBBF24' }
                    : { text:'#111827', track:'#E5E7EB', users:'#2563EB', artists:'#10B981', bookings:'#F59E0B' };
    }
    function pick(label){
      var s = String(label||'').trim().toLowerCase();
      if (s === 'user') return 'users';
      if (s === 'verified-artist' || s === 'artist' || s === 'artists') return 'artists';
      if (s === 'booking' || s === 'bookings') return 'bookings';
      return null;
    }
    function summarize(){
      var data = parseStats(); var sums = { users:0, artists:0, bookings:0 };
      for (var i=0;i<data.length;i++){ var k = pick(data[i].label); if (k) sums[k] += Math.max(0, Number(data[i].count)||0); }
      return sums;
    }
    function renderDonut(hostId, value, total, color){
      var host = document.getElementById(hostId); if (!host) return;
      host.innerHTML = '';
      var size = Math.max(120, Math.min(host.clientWidth||160, host.clientHeight||160));
      var radius = Math.floor((size/2) - 8); var stroke = 10; var c = 2 * Math.PI * radius;
      var th = theme();
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox', '0 0 '+size+' '+size); svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
      var cx = size/2, cy = size/2;
      // Track
      var track = document.createElementNS(svg.namespaceURI,'circle');
      track.setAttribute('cx', cx); track.setAttribute('cy', cy); track.setAttribute('r', radius);
      track.setAttribute('fill','none'); track.setAttribute('stroke', th.track); track.setAttribute('stroke-width', stroke);
      svg.appendChild(track);
      // Arc
      var pct = total>0 ? (value/total) : 0; pct = Math.max(0, Math.min(1, pct));
      var arc = document.createElementNS(svg.namespaceURI,'circle');
      arc.setAttribute('cx', cx); arc.setAttribute('cy', cy); arc.setAttribute('r', radius);
      arc.setAttribute('fill','none'); arc.setAttribute('stroke', color); arc.setAttribute('stroke-width', stroke);
      arc.setAttribute('stroke-linecap','round');
      arc.setAttribute('stroke-dasharray', c.toString());
      arc.setAttribute('stroke-dashoffset', String(c * (1 - pct)));
      arc.setAttribute('transform', 'rotate(-90 '+cx+' '+cy+')');
      svg.appendChild(arc);
      // Center label
      var txt = document.createElementNS(svg.namespaceURI,'text');
      txt.setAttribute('x', cx); txt.setAttribute('y', cy+4); txt.setAttribute('text-anchor','middle'); txt.setAttribute('fill', th.text); txt.setAttribute('font-size','14'); txt.setAttribute('font-weight','700');
      txt.textContent = total>0 ? Math.round(pct*100)+'%' : '—';
      svg.appendChild(txt);
      host.appendChild(svg);
    }
    function render(){
      var sums = summarize(); var total = sums.users + sums.artists + sums.bookings; var th = theme();
      renderDonut('donut-users', sums.users, total, th.users);
      renderDonut('donut-artists', sums.artists, total, th.artists);
      renderDonut('donut-bookings', sums.bookings, total, th.bookings);
    }
    function onResize(){ if (window.__dashboardDonutRaf) cancelAnimationFrame(window.__dashboardDonutRaf); window.__dashboardDonutRaf = requestAnimationFrame(render); }
    window.__dashboardDonuts = { render: render };
    render();
    window.addEventListener('resize', onResize);
    // Re-render on theme change
    try {
      var _origSetTheme2 = window.__setTheme;
      if (_origSetTheme2 && !_origSetTheme2._patchedForDonut){
        window.__setTheme = function(mode){ _origSetTheme2(mode); try { window.__dashboardDonuts && window.__dashboardDonuts.render(); } catch(_){ } };
        window.__setTheme._patchedForDonut = true;
      }
    } catch(_){ }
  } catch(_){ }
};

// ---------------- Right-hand Online Admins Sidebar ----------------
(function onlineAdminsSidebar(){
  function qs(id){ return document.getElementById(id); }
  function initials(name){ try { name = String(name||''); return name.trim().charAt(0).toUpperCase() || '?'; } catch(_){ return '?'; } }
  function esc(s){ try { const d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; } catch(_){ return String(s||''); } }
  function cardFor(a){
    var li = document.createElement('li');
    li.className = 'p-2.5 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition flex items-center gap-3.5';
    var avatar = document.createElement('div');
    avatar.className = 'w-9 h-9 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold shrink-0 relative ring-1 ring-gray-900/5 dark:ring-white/10';
    if (a.avatar){
      var img = document.createElement('img'); img.src = a.avatar; img.alt = 'Avatar'; img.loading = 'lazy'; img.className = 'w-full h-full object-cover'; avatar.appendChild(img);
    } else {
      avatar.textContent = initials(a.name || a.user_name || a.username || a.full_name || '');
    }
    var dot = document.createElement('span'); dot.className = 'absolute -right-0 -bottom-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-green-500';
    // Add a subtle ping ring for online
    var ping = document.createElement('span'); ping.className = 'absolute -right-0 -bottom-0 w-3 h-3 rounded-full bg-green-400/60 dark:bg-green-300/50 animate-ping'; avatar.appendChild(ping);
    avatar.appendChild(dot);
    var info = document.createElement('div'); info.className = 'flex-1 min-w-0';
    var line = document.createElement('div'); line.className = 'text-[13px] md:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate'; line.textContent = a.full_name || a.username || a.user_name || 'Admin';
    info.appendChild(line);
    var act = document.createElement('button'); act.type = 'button'; act.className = 'ml-auto px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700'; act.textContent = 'Message';
    act.addEventListener('click', function(e){
      e.preventDefault();
      try {
        if (typeof window.openMessageOverlay === 'function') { window.openMessageOverlay(a); return; }
        if (typeof window.loadAdminManagement === 'function') {
          window.loadAdminManagement();
          setTimeout(function(){ try { if (typeof window.openMessageOverlay === 'function') window.openMessageOverlay(a); } catch(_){ } }, 700);
        }
      } catch(_){ }
    });
    li.appendChild(avatar); li.appendChild(info); li.appendChild(act);
    return li;
  }
  async function fetchOnline(){
    try {
      const res = await fetch('/dashboard/api/admins/', { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
      const data = await res.json();
      const list = (data && data.results) ? data.results : (Array.isArray(data) ? data : []);
      // Filter online only
      const online = list.filter(function(x){ return String(x && x.status).toLowerCase() === 'online'; });
      return online;
    } catch(_){ return []; }
  }
  function render(list){
    try {
      var ul = qs('online-admins-list'); if (!ul) return;
      ul.setAttribute('aria-busy','true');
      ul.innerHTML = '';
      if (!list || !list.length){
        var empty = document.createElement('li'); empty.className = 'text-xs text-gray-500 dark:text-gray-400 px-2 py-1'; empty.textContent = 'No one online'; ul.appendChild(empty);
      } else {
        var frag = document.createDocumentFragment();
        list.forEach(function(a){ frag.appendChild(cardFor(a)); });
        ul.appendChild(frag);
      }
      ul.setAttribute('aria-busy','false');
    } catch(_){ }
  }
  async function refresh(){ render(await fetchOnline()); }
  window.refreshOnlineAdmins = refresh;
  // Start polling when sidebar exists
  function start(){
    try {
      if (!qs('right-sidebar')) return;
      // Force-show on md+ viewports in case 'hidden' persists
      try {
        var mql = window.matchMedia && window.matchMedia('(min-width: 768px)');
        if (mql && mql.matches) {
          var rs = qs('right-sidebar'); if (rs) rs.classList.remove('hidden');
          // Ensure content root right margin present
          var main = document.getElementById('content-root'); if (main && !main.classList.contains('md:mr-64')) { main.classList.add('md:mr-64'); }
        }
      } catch(_){ }
      refresh();
      if (window.__onlineAdminsTimer) { clearInterval(window.__onlineAdminsTimer); }
      window.__onlineAdminsTimer = setInterval(refresh, 8000);
      // collapse on mobile button
      var btn = document.getElementById('toggleRightSidebar'); if (btn){ btn.addEventListener('click', function(){ var a = qs('right-sidebar'); if (a) a.classList.toggle('hidden'); }); }
    } catch(_){ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // Avoid overlapping footer like left sidebar
  (function adjustRight(){
    function calc(){
      try {
        var aside = document.getElementById('right-sidebar'); var footer = document.querySelector('footer'); if (!aside || !footer) return;
        var fr = footer.getBoundingClientRect(); var vpH = window.innerHeight || document.documentElement.clientHeight; var visible = fr.top < vpH; aside.style.bottom = visible ? (footer.offsetHeight||0) + 'px' : '0px';
      } catch(_){ }
    }
    var raf; function on(){ if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(calc); }
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on); try { new ResizeObserver(on).observe(document.querySelector('footer')); } catch(_){ }
    document.addEventListener('DOMContentLoaded', calc); setTimeout(calc, 0);
  })();
})();

// Ensure human-friendly table labels are available even when the tables partial
// is injected via innerHTML (its inline scripts won't execute).
(function ensureLabelHelper(){
  try {
    window.__TABLE_LABELS_DEFAULT = window.__TABLE_LABELS_DEFAULT || {
      1: 'Admin',
      2: 'User',
      3: 'Verified-Artist',
      4: 'Payment',
      5: 'Artist Service',
      6: 'Artist Application',
      7: 'Artist Availability',
      8: 'Artist-Calendar',
      9: 'Booking',
      10: 'Message'
    };
    if (typeof window.getTableLabel !== 'function') {
      window.getTableLabel = function(id){
        var key = parseInt(id, 10);
        var map = (window.TABLE_LABELS || window.__TABLE_LABELS_DEFAULT || {});
        return map[key] || ('Table ' + key);
      };
    }
  } catch(_){ }
})();

// Expose the current admin avatar URL from the sidebar (if present)
(function exposeAdminAvatarUrl(){
  try {
    var el = document.querySelector('[data-admin-avatar-url]');
    var url = el ? el.getAttribute('data-admin-avatar-url') : '';
    if (url) { window.__admin_avatar_url = url; }
  } catch (e) { /* no-op */ }
})();

// Load Tables via AJAX and inject into content-root
window.loadTables = async function(){
  try {
    window.startLoading && window.startLoading();
    window.updateAriaStatus && window.updateAriaStatus('Loading tables…');
    const res = await fetch('/dashboard/tables/', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    try { var _hdr = res.headers && res.headers.get('X-Label-Map'); if (_hdr) { window.TABLE_LABELS = JSON.parse(_hdr); } } catch(_){ }
    const html = await res.text();
    var root = document.getElementById('content-root');
    if (root) root.innerHTML = html;
    function initTables(){
      try {
        const picker = document.getElementById('tablePicker');
        const loadBtn = document.getElementById('loadTableBtn');
        const refreshBtn = document.getElementById('refreshActiveBtn');
        function ensureDashReady(cb){
          try {
            if (typeof window.refreshTable === 'function' && typeof window.setActiveTable === 'function') { cb && cb(); return; }
            var existing = document.querySelector('script[data-dash-js]');
            if (existing) { setTimeout(function(){ ensureDashReady(cb); }, 0); return; }
            var s = document.createElement('script');
            s.src = '/static/js/dashboard.js';
            s.setAttribute('data-dash-js','1');
            s.onload = function(){ cb && cb(); };
            document.head.appendChild(s);
          } catch(_) { }
        }
        const initial = picker ? picker.value : 1;
        ensureDashReady(()=> { if (typeof window.setActiveTable === 'function') window.setActiveTable(initial); });
        if (loadBtn) loadBtn.addEventListener('click', ()=> ensureDashReady(()=> window.setActiveTable(picker.value)));
        if (refreshBtn) refreshBtn.addEventListener('click', ()=> ensureDashReady(()=> window.refreshTable(parseInt(picker.value))));
        if (picker) picker.addEventListener('change', ()=> ensureDashReady(()=> window.setActiveTable(picker.value)));
        (function initCustomTableDropdown(){
          try {
            var wrapper = document.getElementById('tablePickerWrapper');
            if (!wrapper || wrapper.getAttribute('data-initialized') === '1') return;
            var select = document.getElementById('tablePicker');
            var displayBtn = document.getElementById('tablePickerDisplay');
            var list = document.getElementById('tablePickerList');
            var text = document.getElementById('tablePickerSelectedText');
            if (!select || !displayBtn || !list || !text) return;
            function openList(){ list.classList.remove('hidden'); displayBtn.setAttribute('aria-expanded','true'); }
            function closeList(){ list.classList.add('hidden'); displayBtn.setAttribute('aria-expanded','false'); }
            function toggleList(){ if (list.classList.contains('hidden')) openList(); else closeList(); }
            function setSelected(value){ if (!value) return; select.value = String(value); text.textContent = (window.getTableLabel ? window.getTableLabel(value) : ('Table ' + value)); var ev = document.createEvent('HTMLEvents'); ev.initEvent('change', true, false); select.dispatchEvent(ev); closeList(); }
            text.textContent = (function(){ var v = (select && select.value ? select.value : (select && select.options[0] ? select.options[0].value : '1')); return (window.getTableLabel ? window.getTableLabel(v) : ('Table ' + v)); })();
            try {
              var items = list.querySelectorAll('li[role="option"]');
              for (var i = 0; i < items.length; i++){
                var v = items[i].getAttribute('data-value');
                var labelEl = items[i].querySelector('[data-role="label"]');
                if (labelEl) { labelEl.textContent = window.getTableLabel(v); }
              }
            } catch(_){ }
            try {
              var cards = document.querySelectorAll('[data-table-card]');
              for (var j = 0; j < cards.length; j++){
                var tid = cards[j].getAttribute('data-table-card');
                var h2 = cards[j].querySelector('h2.font-semibold');
                if (h2) { h2.textContent = window.getTableLabel(tid); }
              }
            } catch(_){ }
            displayBtn.addEventListener('click', function(){ toggleList(); });
            list.addEventListener('click', function(e){ var li = e.target.closest('li[role="option"]'); if (!li) return; setSelected(li.getAttribute('data-value')); });
            displayBtn.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleList(); } if (e.key === 'Escape') { closeList(); } });
            list.addEventListener('keydown', function(e){ if (e.key === 'Escape') { closeList(); } });
            document.addEventListener('click', function(e){ if (!wrapper.contains(e.target)) closeList(); });
            wrapper.setAttribute('data-initialized','1');
          } catch(_){ }
        })();
        try { document.title = (document.title || '').replace(/\s·\s.*$/, '') + ' · Tables'; } catch(e){ }
        window.showNotification && window.showNotification('Tables', 'info');
        try { if (window.history && window.history.pushState) { window.history.pushState({ page: 'tables' }, '', '/dashboard/tables/'); } } catch(e){ }
        if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar('/dashboard/tables/'); }
        if (window.__tablesAutoTimer) { clearInterval(window.__tablesAutoTimer); window.__tablesAutoTimer = null; }
        window.__tablesAutoTimer = setInterval(function(){
          try {
            var sel = document.getElementById('tablePicker');
            var tid = sel ? parseInt(sel.value, 10) : 1;
            var pausedUntil = (typeof window.__tablesPauseUntil !== 'undefined') ? window.__tablesPauseUntil : 0;
            if (Date.now() <= (pausedUntil || 0)) { return; }
            if (typeof refreshTable === 'function') { refreshTable(tid); }
          } catch(_) { }
        }, 120000);
      } catch (e) {
        window.location.href = '/dashboard/tables/';
      }
    }
    if (typeof window.refreshTable !== 'function' || typeof window.refreshLogs !== 'function'){
      var already = document.querySelector('script[data-dash-js]');
      if (!already){
        var s = document.createElement('script');
        s.src = '/static/js/dashboard.js';
        s.async = true;
        s.setAttribute('data-dash-js','1');
        s.onload = initTables;
        s.onerror = function(){ window.location.href = '/dashboard/tables/'; };
        document.head.appendChild(s);
      } else {
        setTimeout(initTables, 0);
      }
    } else {
      initTables();
    }
    window.toggleSidebar && window.toggleSidebar(false);
    window.updateAriaStatus && window.updateAriaStatus('Tables loaded');
  } catch (e) {
    window.updateAriaStatus && window.updateAriaStatus('Failed to load tables');
    window.showNotification && window.showNotification('Failed to load tables', 'error');
    window.location.href = '/dashboard/tables/';
  } finally { window.stopLoading && window.stopLoading(); }
};

// Click handler used by the sidebar link to prefer AJAX navigation with a graceful fallback
window.navToTables = function(ev){
  try {
    if (ev && ev.preventDefault) ev.preventDefault();
    window.loadTables && window.loadTables();
    return false;
  } catch(e){ return true; }
};

// Mobile sidebar toggle
window.toggleSidebar = function(force){
  var aside = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  if (!aside) return;
  var currentlyHidden = aside.classList.contains('hidden');
  var open = (force === true) || (force === undefined && currentlyHidden) ? true
            : (force === false) ? false
            : !currentlyHidden;
  if (open){
    aside.classList.remove('hidden');
    if (overlay) overlay.classList.remove('hidden');
  } else {
    aside.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  }
};
// Close sidebar on Escape (mobile)
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') window.toggleSidebar(false); });

// Load Admin Profile via AJAX and inject into content-root
window.loadAdminProfile = async function(){
  try {
    window.startLoading && window.startLoading();
    window.updateAriaStatus && window.updateAriaStatus('Loading profile…');
    const res = await fetch('/auth/profile/', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const html = await res.text();
    var root = document.getElementById('content-root');
    if (root) root.innerHTML = html;
    (function bindProfileUI(){
      try {
        const container = document.getElementById('content-root');
        if (!container) return;
        const editBtn = container.querySelector('div.border-b button');
        if (editBtn) editBtn.addEventListener('click', function(){ if (typeof window.profileEnterEditMode==='function') window.profileEnterEditMode(); });
        const cancelBtn = container.querySelector('#profile-edit-mode button[type="button"]:not(.bg-gray-800)');
        if (cancelBtn) cancelBtn.addEventListener('click', function(){ if (typeof window.profileCancelEdit==='function') window.profileCancelEdit(); });
        const avatarInput = container.querySelector('#avatar-input');
        if (avatarInput) avatarInput.addEventListener('change', function(){ if (typeof window.profileUploadAvatar==='function') window.profileUploadAvatar(avatarInput); });
        const avatarInputEdit = container.querySelector('#avatar-input-edit');
        if (avatarInputEdit) avatarInputEdit.addEventListener('change', function(){ if (typeof window.profileUploadAvatar==='function') window.profileUploadAvatar(avatarInputEdit); });
        container.querySelectorAll('button').forEach(function(btn){
          const t = (btn.textContent||'').trim().toLowerCase();
          if (t === 'delete') { btn.addEventListener('click', function(){ if (typeof window.profileDeleteAvatar==='function') window.profileDeleteAvatar(); }); }
        });
        const editForm = container.querySelector('#profile-edit-form');
        if (editForm) editForm.addEventListener('submit', function(ev){ if (typeof window.profileSave==='function') window.profileSave(ev); });
        const pwdForm = container.querySelector('#password-form');
        if (pwdForm) pwdForm.addEventListener('submit', function(ev){ if (typeof window.profileChangePassword==='function') window.profileChangePassword(ev); });

        // Attach Tailwind-styled datepicker to birth_date without adding new files
        try {
          const birthInput = container.querySelector('#profile-edit-form input[name="birth_date"]');
          if (birthInput) { attachTailwindDatepicker(birthInput); }
        } catch(_){ }

        // Mirror latest avatar from profile view into the left sidebar card
        try {
          var profileAvatarEl = container.querySelector(".w-36.h-36 img, img[alt='Avatar']");
          var sidebarCard = document.querySelector('.user-profile-card');
          if (sidebarCard) {
            var sidebarHolder = sidebarCard.querySelector('.w-12.h-12.rounded-full.overflow-hidden');
            var sidebarImg = sidebarHolder ? sidebarHolder.querySelector('img') : null;
            // Determine current URL in the profile view
            var newUrl = profileAvatarEl && profileAvatarEl.getAttribute('src');
            if (newUrl) {
              if (sidebarImg) { sidebarImg.src = newUrl; }
              else if (sidebarHolder) {
                sidebarHolder.innerHTML = '';
                var simg = document.createElement('img');
                simg.alt = 'Profile'; simg.loading = 'lazy'; simg.className = 'w-full h-full object-cover'; simg.src = newUrl; sidebarHolder.appendChild(simg);
              }
              try { sidebarCard.setAttribute('data-admin-avatar-url', newUrl); } catch(_){ }
            } else {
              // No avatar: ensure placeholder is visible
              if (sidebarHolder && sidebarImg) { sidebarHolder.removeChild(sidebarImg); }
            }
          }
        } catch(_){ }
      } catch(_) {}
    })();
    window.updateAriaStatus && window.updateAriaStatus('Profile loaded');
    window.toggleSidebar && window.toggleSidebar(false);
    window.showNotification && window.showNotification('Profile', 'info');
  } catch (e) {
    window.updateAriaStatus && window.updateAriaStatus('Failed to load profile');
    window.showNotification && window.showNotification('Failed to load profile', 'error');
  } finally { window.stopLoading && window.stopLoading(); }
};

// Admin Profile global helpers
window.profileEnterEditMode = function(){
  var v = document.getElementById('profile-view-mode');
  var e = document.getElementById('profile-edit-mode');
  if (!v || !e) return;
  v.classList.add('hidden');
  e.classList.remove('hidden');
  window.updateAriaStatus && window.updateAriaStatus('Edit mode enabled');
};
window.profileCancelEdit = function(){
  var v = document.getElementById('profile-view-mode');
  var e = document.getElementById('profile-edit-mode');
  if (!v || !e) return;
  e.classList.add('hidden');
  v.classList.remove('hidden');
  window.updateAriaStatus && window.updateAriaStatus('Edit mode cancelled');
};
window.profileSave = async function(ev){
  ev && ev.preventDefault && ev.preventDefault();
  var form = document.getElementById('profile-edit-form');
  if (!form) return;
  const formData = new FormData(form);
  try{
    const res = await fetch('/auth/profile/update/', {
      method: 'POST',
      headers: { 'X-CSRFToken': window.getCookie && window.getCookie('csrftoken') },
      body: formData
    });
    const data = await res.json();
    if(data.success){
      window.updateAriaStatus && window.updateAriaStatus('Profile saved');
      window.showNotification && window.showNotification('Profile updated', 'success');
      window.loadAdminProfile && window.loadAdminProfile();
    } else {
      window.showNotification && window.showNotification('Save failed', 'error');
    }
  } catch(err){
    window.showNotification && window.showNotification('Network error', 'error');
  }
};
window.profileUploadAvatar = async function(input){
  if(!input || !input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append('avatar', input.files[0]);
  try{
    const res = await fetch('/auth/profile/avatar/', {
      method: 'POST',
      headers: { 'X-CSRFToken': window.getCookie && window.getCookie('csrftoken') },
      body: fd
    });
    const data = await res.json();
    if(data.success){
      window.updateAriaStatus && window.updateAriaStatus('Avatar updated');
      // Immediately reflect in left sidebar without full page reload
      try {
        var card = document.querySelector('.user-profile-card');
        if (card) {
          var holder = card.querySelector('.w-12.h-12.rounded-full.overflow-hidden');
          var img = holder ? holder.querySelector('img') : null;
          var url = URL.createObjectURL(input.files[0]);
          if (img) { img.src = url; }
          else if (holder) {
            // Replace placeholder SVG with an <img>
            holder.innerHTML = '';
            var i = document.createElement('img');
            i.alt = 'Profile'; i.loading = 'lazy'; i.className = 'w-full h-full object-cover'; i.src = url; holder.appendChild(i);
          }
          try { card.setAttribute('data-admin-avatar-url', url); } catch(_){ }
        }
      } catch(_){ }
      window.loadAdminProfile && window.loadAdminProfile();
    } else {
      var msg = (data && (data.error || data.message)) || 'Avatar upload failed';
      window.showNotification && window.showNotification(msg, 'error');
    }
  } catch(err){
    window.showNotification && window.showNotification('Avatar upload error', 'error');
  }
};
window.profileDeleteAvatar = async function(){
  try{
    const res = await fetch('/auth/profile/avatar/delete/', {
      method: 'POST',
      headers: { 'X-CSRFToken': window.getCookie && window.getCookie('csrftoken') }
    });
    const data = await res.json();
    if(data.success){
      window.updateAriaStatus && window.updateAriaStatus('Avatar removed');
      try {
        var card = document.querySelector('.user-profile-card');
        var holder = card && card.querySelector('.w-12.h-12.rounded-full.overflow-hidden');
        var img = holder && holder.querySelector('img');
        if (holder && img) { holder.removeChild(img); }
        if (card) { card.setAttribute('data-admin-avatar-url', ''); }
      } catch(_){ }
      window.loadAdminProfile && window.loadAdminProfile();
    } else {
      window.showNotification && window.showNotification('Avatar delete failed', 'error');
    }
  } catch(err){
    window.showNotification && window.showNotification('Avatar delete error', 'error');
  }
};
window.profileChangePassword = async function(ev){
  ev && ev.preventDefault && ev.preventDefault();
  var form = document.getElementById('password-form');
  if (!form) return;
  const fd = new FormData(form);
  try{
    const res = await fetch('/auth/profile/password/', {
      method: 'POST',
      headers: { 'X-CSRFToken': window.getCookie && window.getCookie('csrftoken') },
      body: fd
    });
    const data = await res.json();
    if(data.success){
      window.updateAriaStatus && window.updateAriaStatus('Password updated');
      window.showNotification && window.showNotification('Password updated', 'success');
      form.reset();
    } else {
      window.showNotification && window.showNotification(data.error || 'Password update failed', 'error');
    }
  } catch(err){
    window.showNotification && window.showNotification('Password update error', 'error');
  }
};

// ------------------ Lightweight Tailwind Datepicker ------------------
// Usage: attachTailwindDatepicker(inputEl)
// - Does not require external files
// - Keeps input value in YYYY-MM-DD for server
// - Dark mode aware via Tailwind classes on <html>.dark
window.attachTailwindDatepicker = function(input){
  try {
    if (!input || input._twDatepicker) return;
    // Normalize to text field for consistent control across browsers
    var initialType = input.getAttribute('type') || 'text';
    if (initialType !== 'text') input.setAttribute('type','text');
    input.setAttribute('inputmode','numeric');
    input.setAttribute('placeholder','YYYY-MM-DD');
    // Utils
    function pad(n){ return (n<10?'0':'') + n; }
    function fmt(d){ return d ? (d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())) : ''; }
    function parse(v){
      try {
        if (!v) return null; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null; var d = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
        return isNaN(d.getTime()) ? null : d;
      } catch(_) { return null; }
    }
    function sameDay(a,b){ return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
    // Host popover
    var host = document.createElement('div');
    host.className = 'absolute z-50 mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 hidden';
    host.setAttribute('role','dialog');
    var header = document.createElement('div'); header.className = 'flex items-center justify-between mb-2';
    var prev = document.createElement('button'); prev.type='button'; prev.className='p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800'; prev.innerHTML='&#x2039;';
    var next = document.createElement('button'); next.type='button'; next.className='p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800'; next.innerHTML='&#x203A;';
    var title = document.createElement('div'); title.className='text-sm font-medium';
    header.appendChild(prev); header.appendChild(title); header.appendChild(next);
    var grid = document.createElement('div'); grid.className = 'grid grid-cols-7 gap-1';
    var weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    var wk = document.createElement('div'); wk.className='grid grid-cols-7 gap-1 mb-1 text-[11px] text-gray-500 dark:text-gray-400';
    weekdays.forEach(function(w){ var s=document.createElement('div'); s.className='text-center'; s.textContent=w; wk.appendChild(s); });
    host.appendChild(header); host.appendChild(wk); host.appendChild(grid);
    // Insert host
    input.parentElement.style.position = input.parentElement.style.position || 'relative';
    input.parentElement.appendChild(host);
    // State
    var current = parse(input.value) || new Date(); current.setHours(0,0,0,0);
    var selected = parse(input.value);
    function render(){
      grid.innerHTML='';
      var year=current.getFullYear(), month=current.getMonth();
      title.textContent = current.toLocaleString(undefined, { month:'long', year:'numeric' });
      var first = new Date(year, month, 1);
      var start = new Date(first); start.setDate(first.getDate() - first.getDay());
      for (var i=0;i<42;i++){
        var d = new Date(start); d.setDate(start.getDate()+i);
        var btn = document.createElement('button'); btn.type='button';
        var isOther = d.getMonth() !== month;
        btn.className = 'text-sm px-2 py-1 rounded text-center w-8 h-8 flex items-center justify-center ' + (isOther ? 'text-gray-400 dark:text-gray-500 ' : 'text-gray-900 dark:text-gray-100 ') + (sameDay(d, selected) ? 'bg-blue-600 text-white ' : 'hover:bg-gray-100 dark:hover:bg-gray-800 ');
        btn.textContent = d.getDate();
        btn.addEventListener('click', function(dd){ return function(){ selected = dd; input.value = fmt(dd); close(); input.dispatchEvent(new Event('change', { bubbles: true })); }; }(new Date(d)));
        grid.appendChild(btn);
      }
    }
    function open(){ host.classList.remove('hidden'); position(); document.addEventListener('keydown', onEsc, true); document.addEventListener('click', onDoc, true); }
    function close(){ host.classList.add('hidden'); document.removeEventListener('keydown', onEsc, true); document.removeEventListener('click', onDoc, true); }
    function onEsc(e){ if (e.key==='Escape') close(); }
    function onDoc(e){ if (!host.contains(e.target) && e.target!==input) close(); }
    function position(){
      try {
        var r = input.getBoundingClientRect(); var pr = input.parentElement.getBoundingClientRect();
        host.style.left = Math.max(0, r.left - pr.left) + 'px';
      } catch(_){ }
    }
    prev.addEventListener('click', function(){ current.setMonth(current.getMonth()-1); render(); });
    next.addEventListener('click', function(){ current.setMonth(current.getMonth()+1); render(); });
    input.addEventListener('focus', function(){ render(); open(); });
    input.addEventListener('click', function(){ render(); open(); });
    input.addEventListener('blur', function(){ /* allow click into picker */ });
    input.addEventListener('input', function(){ var d=parse(input.value); if (d){ selected=d; current=new Date(d); current.setDate(1); } });
    input._twDatepicker = { open: open, close: close };
  } catch(_){ }
};

// Load Admin Management via AJAX and inject into content-root
window.loadAdminManagement = async function(){
  try {
    window.startLoading && window.startLoading();
    window.updateAriaStatus && window.updateAriaStatus('Loading admin management…');
    const res = await fetch('/dashboard/Admin_management/', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const html = await res.text();
    var root = document.getElementById('content-root');
    if (root) root.innerHTML = html;
    function ensureAdminJS(cb){
      try {
        if (typeof window.initAdminManagement === 'function') { cb && cb(); return; }
        var existing = document.querySelector("script[src$='/static/js/admin_management.js']");
        if (existing) { setTimeout(function(){ ensureAdminJS(cb); }, 0); return; }
        var s = document.createElement('script');
        s.src = '/static/js/admin_management.js';
        s.onload = function(){ cb && cb(); };
        document.head.appendChild(s);
      } catch(_) { }
    }
    ensureAdminJS(function(){ try { window.initAdminManagement && window.initAdminManagement(); } catch(_){ } });
    try { if (window.history && window.history.pushState) { window.history.pushState({ page: 'admin_mgmt' }, '', '/dashboard/Admin_management/'); } } catch(e){ }
    if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar('/dashboard/Admin_management/'); }
    window.toggleSidebar && window.toggleSidebar(false);
    window.showNotification && window.showNotification('Admin Management', 'info');
    window.updateAriaStatus && window.updateAriaStatus('Admin management loaded');
  } catch (e) {
    window.updateAriaStatus && window.updateAriaStatus('Failed to load admin management');
    window.location.href = '/dashboard/Admin_management/';
  } finally { window.stopLoading && window.stopLoading(); }
};

// DOMContentLoaded bindings and navigation intercepts
document.addEventListener('DOMContentLoaded', function(){
  try {
    // Bind dark mode toggle button
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn && !themeBtn.getAttribute('data-csp-bound')){
      themeBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        try {
          var isDark = document.documentElement.classList.contains('dark');
          var next = isDark ? 'light' : 'dark';
          if (typeof window.__setTheme === 'function') window.__setTheme(next);
          window.updateAriaStatus && window.updateAriaStatus(next === 'dark' ? 'Dark mode enabled' : 'Dark mode disabled');
        } catch(_){}
      });
      themeBtn.setAttribute('data-csp-bound','1');
    }
  } catch(_){}

  try {
    var tablesLink = document.querySelector("a[href='/dashboard/tables/']");
    if (tablesLink){
      tablesLink.addEventListener('click', function(ev){
        if (typeof window.loadTables === 'function'){
          ev.preventDefault();
          window.loadTables();
        }
      });
    }
    try {
      var adminLink = document.querySelector("a[href='/dashboard/Admin_management/']");
      if (adminLink){
        adminLink.addEventListener('click', function(ev){
          if (typeof window.loadAdminManagement === 'function'){
            ev.preventDefault();
            window.loadAdminManagement();
          }
        });
      }
    } catch(_) { }
  } catch(e){ }

  // Header controls
  try {
    // Initialize Dashboard Data Overview chart if present
    (function initDashboardChartOnLoad(){
      try {
        var host = document.getElementById('chart-table-distribution');
        if (host && typeof window.initDashboardCharts === 'function') {
          window.initDashboardCharts();
        }
        var donutsHost = document.getElementById('donut-cards');
        if (donutsHost && typeof window.initDashboardDonuts === 'function') {
          window.initDashboardDonuts();
        }
        var btn = document.getElementById('dashboardChartRefresh');
        if (btn) btn.addEventListener('click', function(){ if (typeof window.refreshDashboardCharts === 'function') window.refreshDashboardCharts(); });
        // Optional WebSocket live updates
        if (typeof window.initDashboardStatsWS === 'function') window.initDashboardStatsWS();
      } catch(_){ }
    })();

    var nb = document.getElementById('notifBtn');
    if (nb && !nb.getAttribute('data-csp-bound')) {
      try { nb.removeAttribute('onclick'); } catch(_){ }
      nb.setAttribute('data-csp-bound','1');
    }
  } catch(_) { }

  try {
    var userMenu = document.getElementById('userMenu');
    var userBtn = userMenu ? userMenu.previousElementSibling : null;
    if (userMenu && userBtn && !userBtn.getAttribute('data-csp-bound')){
      try { userBtn.removeAttribute('onclick'); } catch(_){ }
      userBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        var hidden = userMenu.classList.contains('hidden');
        if (hidden) { userMenu.classList.remove('hidden'); }
        else { userMenu.classList.add('hidden'); }
        try { userBtn.setAttribute('aria-expanded', hidden ? 'true' : 'false'); } catch(_){}
      });
      document.addEventListener('click', function(e){
        try {
          if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) {
            userMenu.classList.add('hidden');
            userBtn.setAttribute('aria-expanded','false');
          }
        } catch(_){ }
      });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { try { userMenu.classList.add('hidden'); userBtn.setAttribute('aria-expanded','false'); } catch(_){ } } });
      userBtn.setAttribute('data-csp-bound','1');
    }
  } catch(_) { }

  try {
    var sbBtn = document.querySelector('header [aria-controls="sidebar"]');
    if (sbBtn && !sbBtn.getAttribute('data-csp-bound')){
      try { sbBtn.removeAttribute('onclick'); } catch(_){ }
      sbBtn.addEventListener('click', function(ev){ ev.preventDefault(); if (typeof window.toggleSidebar === 'function') window.toggleSidebar(true); });
      sbBtn.setAttribute('data-csp-bound','1');
    }
  } catch(_) { }

  try {
    if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar(window.location.pathname); }
  } catch (e) { }

  try {
    window.addEventListener('popstate', function(){
      try {
        if (location.pathname === '/dashboard/tables/'){
          if (typeof window.loadTables === 'function') window.loadTables();
          if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar('/dashboard/tables/'); }
        } else if (location.pathname === '/dashboard/') {
          if (window.__tablesAutoTimer) { try { clearInterval(window.__tablesAutoTimer); } catch(_){} window.__tablesAutoTimer = null; }
          if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar('/dashboard/'); }
          window.location.href = '/dashboard/';
        }
      } catch (e) { }
    });
  } catch (e) { }

  try { if (window.__tablesAutoTimer) { clearInterval(window.__tablesAutoTimer); window.__tablesAutoTimer = null; } } catch(_){ }

  try {
    document.addEventListener('keydown', function(ev){
      try {
        var t = ev.target && ev.target.closest && ev.target.closest('.user-profile-card');
        if (!t) return;
        if (ev.key === 'Enter' || ev.key === ' '){
          ev.preventDefault();
          if (typeof window.loadAdminProfile === 'function') window.loadAdminProfile();
        }
      } catch(_){}
    });
  } catch(_) { }

  try {
    document.addEventListener('click', function(ev){
      var target = ev.target;
      var overlay = target && (target.id === 'sidebar-overlay' ? target : target.closest && target.closest('#sidebar-overlay'));
      if (overlay) { ev.preventDefault(); if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false); return; }
      // Handle status dropdown FIRST so clicks inside it don't bubble to profile card navigation
      var trigger = target && (target.closest && target.closest('.status-trigger'));
      if (trigger) {
        ev.preventDefault();
        var dd = document.getElementById('status-dropdown-menu');
        if (dd){
          var willOpen = dd.classList.contains('hidden');
          dd.classList.toggle('hidden');
          try { trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false'); } catch(_){ }
          if (willOpen){
            // Initialize menu items tabindex and selected state
            var items = dd.querySelectorAll('button[role="menuitemradio"]');
            var currentText = (document.getElementById('current-status') || {}).textContent || '';
            for (var i=0;i<items.length;i++){
              items[i].setAttribute('tabindex', '-1');
              var val = items[i].getAttribute('data-status');
              var checked = (currentText.toLowerCase().indexOf(val) >= 0);
              items[i].setAttribute('aria-checked', checked ? 'true' : 'false');
            }
            if (items && items[0]) { items[0].focus(); }
          } else {
            try { trigger.focus(); } catch(_){ }
          }
        }
        return;
      }
      // Prevent profile card navigation when clicking inside the status dropdown region
      var profileCard = target && (target.closest && target.closest('.user-profile-card'));
      if (profileCard && !(target.closest && (target.closest('.status-dropdown') || target.closest('#status-dropdown-menu')))) {
        ev.preventDefault(); if (typeof window.loadAdminProfile === 'function') window.loadAdminProfile(); return; }
      var changeBtn = target && (target.closest && target.closest('#status-dropdown-menu button'));
      if (changeBtn) {
        ev.preventDefault();
        var txt = (changeBtn.textContent || '').toLowerCase();
        var status = txt.indexOf('unavailable') >= 0 ? 'unavailable' : 'available';
        try {
          var statusSpan = document.getElementById('current-status');
          var dropdown = document.getElementById('status-dropdown-menu');
          if (statusSpan){
            statusSpan.textContent = '';
            const dot = document.createElement('span');
            dot.className = 'w-2 h-2 me-1 rounded-full';
            const text = document.createTextNode(status === 'available' ? 'Available' : 'Unavailable');
            if (status === 'available') {
              statusSpan.className = 'inline-flex items-center bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-xs font-medium px-2.5 py-0.5 rounded-full';
              dot.classList.add('bg-green-500');
            } else {
              statusSpan.className = 'inline-flex items-center bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 text-xs font-medium px-2.5 py-0.5 rounded-full';
              dot.classList.add('bg-red-500');
            }
            statusSpan.appendChild(dot);
            statusSpan.appendChild(text);
          }
        
  // Update aria-checked across items
          try {
            var all = document.querySelectorAll('#status-dropdown-menu button[role="menuitemradio"]');
            for (var j=0;j<all.length;j++){
              var v = all[j].getAttribute('data-status');
              all[j].setAttribute('aria-checked', v === status ? 'true' : 'false');
            }
          } catch(_){ }
          if (dropdown) dropdown.classList.add('hidden');
          try {
            var trig = document.querySelector('.status-trigger');
            if (trig){ trig.setAttribute('aria-expanded','false'); trig.focus(); }
          } catch(_){ }
        } catch(_){ }
        return;
      }
    });
    document.addEventListener('click', function(e){
      try {
        var dropdown = document.getElementById('status-dropdown-menu');
        var trigger2 = document.querySelector('.status-trigger');
        if (!dropdown || !trigger2) return;
        if (!trigger2.contains(e.target) && !dropdown.contains(e.target)){
          dropdown.classList.add('hidden');
          try { trigger2.setAttribute('aria-expanded','false'); } catch(_){ }
        }
      } catch(_){ }
    });
  } catch(_) { }
});

// Sidebar active/highlight helper
window.setActiveSidebar = function(targetPath){
  try {
    var aside = document.getElementById('sidebar');
    if (!aside) return;
    var links = aside.querySelectorAll('a[href]');
    var path = (targetPath || '').replace(/\/$/, '/') || '/';
    links.forEach(function(a){
      a.classList.remove('bg-gray-100');
      a.removeAttribute('aria-current');
    });
    links.forEach(function(a){
      try {
        var href = a.getAttribute('href') || '';
        var u = new URL(href, window.location.origin);
        var ap = (u.pathname || '').replace(/\/$/, '/') || '/';
        if (ap === path) {
          a.classList.add('bg-gray-100');
          // Also add dark-mode active background for clarity
          a.classList.add('dark:bg-gray-800');
          a.setAttribute('aria-current', 'page');
        }
      } catch (_) { }
    });
  } catch (_) { }
};

// Ensure fixed sidebar does not overlap the footer
(function(){
  function adjustSidebarBottom(){
    try {
      var aside = document.getElementById('sidebar');
      var footer = document.querySelector('footer');
      if (!aside || !footer) return;
      var fr = footer.getBoundingClientRect();
      var vpH = window.innerHeight || document.documentElement.clientHeight;
      var visible = fr.top < vpH;
      if (visible) {
        var h = Math.max(footer.offsetHeight || 0, 0);
        aside.style.bottom = h + 'px';
      } else {
        aside.style.bottom = '0px';
      }
    } catch(_){ }
  }
  var _raf;
  function onScrollResize(){
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(adjustSidebarBottom);
  }
  window.addEventListener('scroll', onScrollResize, { passive: true });
  window.addEventListener('resize', onScrollResize);
  try { new ResizeObserver(adjustSidebarBottom).observe(document.querySelector('footer')); } catch(_){ }
  document.addEventListener('DOMContentLoaded', adjustSidebarBottom);
  setTimeout(adjustSidebarBottom, 0);
})();
