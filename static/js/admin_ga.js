// static/js/admin_ga.js
// Initialize Google Analytics if GA_GTAG_ID is present via meta#ga-config
(function(){
  try {
    var meta = document.getElementById('ga-config');
    if (!meta) return;
    var gaId = (meta.getAttribute('data-ga-id') || '').trim();
    if (!gaId) return;
    // Dynamically load gtag.js
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    s.onload = function(){
      try {
        window.dataLayer = window.dataLayer || [];
        function gtag(){ dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', gaId);
      } catch(_){}
    };
    document.head.appendChild(s);
  } catch(_) { /* no-op */ }
})();
