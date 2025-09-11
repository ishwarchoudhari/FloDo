// Tailwind CDN configuration to enable class-based dark mode
// This must be loaded BEFORE https://cdn.tailwindcss.com
(function(){
  try {
    window.tailwind = window.tailwind || {};
    window.tailwind.config = Object.assign({}, window.tailwind.config || {}, {
      darkMode: 'class'
    });
  } catch (_) { /* no-op */ }
})();
