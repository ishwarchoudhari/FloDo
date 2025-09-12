/*
Client Portal: Artist Apply page enhancements
- File selection preview (names, sizes)
- Basic client-side validation hints (non-blocking; server remains source of truth)
- Accessibility: announce selected files and errors politely
No backend behavior changes.
*/
(function () {
  const byId = (id) => document.getElementById(id);
  const certificates = byId('certificates');
  const preview = byId('file-preview');
  const hp = byId('website'); // honeypot — we do not submit this

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0, v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
  }

  function announce(msg) {
    try {
      let live = document.getElementById('aria-live');
      if (!live) {
        live = document.createElement('div');
        live.id = 'aria-live';
        live.setAttribute('aria-live', 'polite');
        live.className = 'sr-only';
        document.body.appendChild(live);
      }
      live.textContent = msg;
    } catch (_) {}
  }

  function renderPreview(files) {
    if (!preview) return;
    preview.innerHTML = '';
    const maxPerFile = 10 * 1024 * 1024; // 10MB
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    const list = document.createDocumentFragment();
    Array.from(files || []).forEach((f) => {
      const li = document.createElement('li');
      const name = f.name || 'file';
      const ext = (name.split('.').pop() || '').toLowerCase();
      const tooBig = typeof f.size === 'number' && f.size > maxPerFile;
      const badExt = allowed.indexOf(ext) === -1;
      li.textContent = `${name} — ${formatBytes(f.size || 0)}`;
      if (tooBig || badExt) {
        li.className = 'text-red-600';
        const why = [];
        if (badExt) why.push(`type .${ext} not allowed`);
        if (tooBig) why.push('exceeds 10MB');
        const small = document.createElement('small');
        small.className = 'ml-2';
        small.textContent = `(${why.join(', ')})`;
        li.appendChild(small);
      } else {
        li.className = 'text-emerald-700 dark:text-emerald-400';
      }
      list.appendChild(li);
    });
    preview.appendChild(list);
    announce(`${(files && files.length) || 0} file(s) selected`);
  }

  function blockBots() {
    try {
      if (!hp) return;
      // If a bot fills the honeypot, warn user visually (non-blocking)
      hp.addEventListener('input', function () {
        this.setAttribute('aria-invalid', 'true');
        this.style.outline = '2px solid #ef4444';
      });
    } catch (_) {}
  }

  function init() {
    if (certificates) {
      certificates.addEventListener('change', function () {
        renderPreview(this.files);
      });
    }
    blockBots();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
