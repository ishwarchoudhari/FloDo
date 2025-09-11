// static/js/settings.js
// Extracted from templates/settings/index.html to comply with CSP.
(function(){
  function loadSystemInfo(){
    try {
      var el = document.getElementById('sysInfo');
      if (!el) return;
      fetch(el.getAttribute('data-endpoint') || '/settings/system-info/')
        .then(function(r){ return r.json(); })
        .then(function(data){ el.textContent = JSON.stringify(data, null, 2); })
        .catch(function(){ el.textContent = 'Failed to load system information.'; });
    } catch(_){}
  }
  function bind(){
    var el = document.getElementById('sysInfo');
    if (el && !el.getAttribute('data-endpoint')){
      // Allow server to override via data attribute when rendering
      try { el.setAttribute('data-endpoint', el.getAttribute('data-endpoint') || (window.__settingsSystemInfoUrl || '')); } catch(_){}
    }
    var btn = document.getElementById('btnSysInfo');
    if (btn && !btn.__bound){ btn.addEventListener('click', loadSystemInfo); btn.__bound = true; }
    // Auto-load on first paint
    if (document.readyState === 'complete') loadSystemInfo(); else window.addEventListener('DOMContentLoaded', loadSystemInfo, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  // Expose for debugging
  window.loadSystemInfo = loadSystemInfo;
})();
