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
      const root = document.documentElement; // use <html> for dark class
      if (theme === 'dark') { root.classList.add('dark'); }
      else { root.classList.remove('dark'); }
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
    try { localStorage.setItem('theme', theme); } catch(_){}
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
      window.loadAdminProfile && window.loadAdminProfile();
    } else {
      window.showNotification && window.showNotification('Avatar upload failed', 'error');
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
      var profileCard = target && (target.closest && target.closest('.user-profile-card'));
      if (profileCard) { ev.preventDefault(); if (typeof window.loadAdminProfile === 'function') window.loadAdminProfile(); return; }
      var trigger = target && (target.closest && target.closest('.status-trigger'));
      if (trigger) {
        ev.preventDefault();
        var dd = document.getElementById('status-dropdown-menu');
        if (dd) dd.classList.toggle('hidden');
        return;
      }
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
              statusSpan.className = 'inline-flex items-center bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full';
              dot.classList.add('bg-green-500');
            } else {
              statusSpan.className = 'inline-flex items-center bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full';
              dot.classList.add('bg-red-500');
            }
            statusSpan.appendChild(dot);
            statusSpan.appendChild(text);
          }
          if (dropdown) dropdown.classList.add('hidden');
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
