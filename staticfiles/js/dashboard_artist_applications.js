// Dashboard Artist Applications: lightweight modal controller (no dependencies)
(() => {
  // Smooth expand/collapse utility for details panels
  function expandSection(el) {
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.classList.remove('hidden');
    if (reduce) {
      // Immediately show without animation
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      return;
    }
    el.style.overflow = 'hidden';
    el.style.maxHeight = '0px';
    // Force layout
    void el.offsetHeight; // reflow
    const target = el.scrollHeight;
    el.style.transition = 'max-height 300ms ease';
    el.style.maxHeight = target + 'px';
    function onEnd() {
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
    }
    el.addEventListener('transitionend', onEnd);
  }

  // Smooth collapse utility for details panels (complement to expandSection)
  function collapseSection(el) {
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.classList.add('hidden');
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      return;
    }
    const start = el.scrollHeight;
    el.style.overflow = 'hidden';
    el.style.maxHeight = start + 'px';
    // Force layout
    void el.offsetHeight; // reflow
    el.style.transition = 'max-height 300ms ease';
    el.style.maxHeight = '0px';
    function onEnd() {
      el.classList.add('hidden');
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
    }
    el.addEventListener('transitionend', onEnd);
  }

  // Small inline confirm dialog (returns Promise<boolean>)
  function showConfirm(scope, message){
    return new Promise(function(resolve){
      try {
        const host = (scope && scope.appendChild ? scope : document.body);
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4';
        wrap.setAttribute('data-confirm','');
        const panel = document.createElement('div');
        panel.className = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl max-w-sm w-full p-4';
        panel.innerHTML = '<div class="text-sm text-gray-800 dark:text-gray-100 mb-3">'+ message +'</div>';
        const row = document.createElement('div');
        row.className = 'flex justify-end gap-2';
        const btnCancel = document.createElement('button');
        btnCancel.className = 'px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200';
        btnCancel.textContent = 'Cancel';
        const btnOk = document.createElement('button');
        btnOk.className = 'px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700';
        btnOk.textContent = 'Confirm';
        row.appendChild(btnCancel); row.appendChild(btnOk);
        panel.appendChild(row); wrap.appendChild(panel);
        host.appendChild(wrap);
        function cleanup(){ try { wrap.remove(); } catch(_){} }
        btnCancel.addEventListener('click', function(){ cleanup(); resolve(false); });
        btnOk.addEventListener('click', function(){ cleanup(); resolve(true); });
        wrap.addEventListener('click', function(e){ if (e.target === wrap){ cleanup(); resolve(false); }});
      } catch(_){ resolve(confirm(message)); }
    });
  }

  // Toast utility (inline banner)
  function showToast(message, type, scope){
    try {
      const root = scope && scope.querySelector ? scope : document.body;
      let host = root.querySelector('#toast-root');
      if (!host){
        host = document.createElement('div');
        host.id = 'toast-root';
        host.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[60] space-y-2 pointer-events-none';
        host.setAttribute('role','status');
        host.setAttribute('aria-live','polite');
        (scope && scope.appendChild ? scope : document.body).appendChild(host);
      }
      const el = document.createElement('div');
      el.className = 'pointer-events-auto px-4 py-2 rounded-lg border shadow-sm text-sm ' + (type==='error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');
      el.textContent = message;
      host.appendChild(el);
      // auto-hide
      setTimeout(() => { try { el.style.opacity = '0'; el.style.transition = 'opacity 200ms'; } catch(_){} }, 1800);
      setTimeout(() => { try { el.remove(); if (host && !host.children.length) host.remove(); } catch(_){} }, 2100);
    } catch(_){}
  }

  function setLinkedVisibility(detailsId, open) {
    const selector = `[data-details-footer="${detailsId}"]`;
    document.querySelectorAll(selector).forEach((node) => {
      if (open) node.classList.remove('hidden'); else node.classList.add('hidden');
    });
    const selector2 = `[data-details-actions="${detailsId}"]`;
    document.querySelectorAll(selector2).forEach((node) => {
      if (open) node.classList.remove('hidden'); else node.classList.add('hidden');
    });
  }

  function closeOtherAccordions(exceptId) {
    document.querySelectorAll('[id^="details-"]').forEach((panel) => {
      if (panel.id !== exceptId && !panel.classList.contains('hidden')) {
        collapseSection(panel);
        setLinkedVisibility(panel.id, false);
        const btn = document.querySelector(`[data-toggle="${panel.id}"]`);
        if (btn) btn.setAttribute('aria-expanded', 'false');
        const icon = btn && btn.querySelector('svg');
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  }

  // Modal helpers with keyboard navigation for certificate previews
  function getCertItems(modal){
    try {
      const container = modal.querySelector('[data-modal-overlay]') || modal;
      const imgs = Array.prototype.slice.call(container.querySelectorAll('img'));
      const links = Array.prototype.slice.call(container.querySelectorAll('a[href]'));
      return imgs.length ? imgs : links; // Prefer images; fall back to links
    } catch(_) { return []; }
  }

  function highlightCertItem(modal, idx){
    try {
      const items = getCertItems(modal);
      if (!items.length) return;
      const cl = 'ring-2 ring-blue-400 dark:ring-blue-300 rounded-md';
      items.forEach((n,i)=>{
        n.classList.remove('ring-2','ring-blue-400','dark:ring-blue-300','rounded-md');
        // improve flicker: only emphasize after image is loaded
        if (i===idx){
          try { n.style.willChange = 'transform, opacity'; } catch(_){}
          if (n.tagName === 'IMG' && !n.complete){
            n.addEventListener('load', function tmp(){ n.classList.add('ring-2','ring-blue-400','dark:ring-blue-300','rounded-md'); n.removeEventListener('load', tmp); }, { once:true });
          } else {
            n.classList.add('ring-2','ring-blue-400','dark:ring-blue-300','rounded-md');
          }
        }
      });
      const target = items[idx];
      if (target && target.scrollIntoView){ target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' }); }
      modal._certIndex = idx;
    } catch(_){}
  }

  function stepCert(modal, dir){
    const items = getCertItems(modal);
    if (!items.length) return;
    let i = typeof modal._certIndex === 'number' ? modal._certIndex : 0;
    i = (i + dir + items.length) % items.length;
    highlightCertItem(modal, i);
  }

  function openModal(el) {
    // Move modal to document.body to avoid being clipped or positioned relative to transformed ancestors
    try {
      if (!el._movedToBody) {
        el._origParent = el.parentNode;
        el._origNext = el.nextSibling;
        el._placeholder = document.createComment('modal-placeholder');
        if (el._origParent) {
          el._origParent.insertBefore(el._placeholder, el._origNext || null);
        }
        document.body.appendChild(el);
        el._movedToBody = true;
      }
    } catch(_){}
    el.classList.remove('hidden');
    el.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    // Init cert navigation
    try {
      const items = getCertItems(el);
      if (items.length){
        highlightCertItem(el, 0);
        // click to select
        items.forEach((n,idx)=>{ n.addEventListener('click', function(){ highlightCertItem(el, idx); }); });
      }
      // keydown handler
      const onKey = function(e){
        if (e.key === 'ArrowRight'){ e.preventDefault(); stepCert(el, +1); }
        else if (e.key === 'ArrowLeft'){ e.preventDefault(); stepCert(el, -1); }
        else if (e.key === 'Escape'){ e.preventDefault(); closeModal(el); }
      };
      el._keyHandler = onKey;
      document.addEventListener('keydown', onKey);
      // on-screen nav buttons
      const btnPrev = el.querySelector('[data-modal-prev]');
      const btnNext = el.querySelector('[data-modal-next]');
      if (btnPrev) btnPrev.addEventListener('click', function(e){ e.preventDefault(); stepCert(el, -1); });
      if (btnNext) btnNext.addEventListener('click', function(e){ e.preventDefault(); stepCert(el, +1); });
      // zoom controls
      let zoom = 1;
      function applyZoom(){
        const items = getCertItems(el);
        items.forEach((n)=>{ try { n.style.transformOrigin = 'center center'; n.style.transform = `scale(${zoom})`; } catch(_){} });
      }
      const zIn = el.querySelector('[data-modal-zoom-in]');
      const zOut = el.querySelector('[data-modal-zoom-out]');
      const zReset = el.querySelector('[data-modal-zoom-reset]');
      if (zIn) zIn.addEventListener('click', function(e){ e.preventDefault(); zoom = Math.min(zoom + 0.1, 3); applyZoom(); });
      if (zOut) zOut.addEventListener('click', function(e){ e.preventDefault(); zoom = Math.max(zoom - 0.1, 0.5); applyZoom(); });
      if (zReset) zReset.addEventListener('click', function(e){ e.preventDefault(); zoom = 1; applyZoom(); });
      applyZoom();
      // fade-in images to avoid flicker
      const imgs = el.querySelectorAll('img');
      imgs.forEach((img)=>{
        try {
          img.style.transition = 'opacity 200ms ease';
          if (!img.complete) { img.style.opacity = '0'; }
          img.addEventListener('load', function(){ img.style.opacity = '1'; });
          // if cached
          if (img.complete) { requestAnimationFrame(()=>{ img.style.opacity = '1'; }); }
        } catch(_){}
      });
    } catch(_){}
  }

  function closeModal(el) {
    el.classList.add('hidden');
    el.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    try { if (el._keyHandler){ document.removeEventListener('keydown', el._keyHandler); delete el._keyHandler; } } catch(_){ }
    // Restore to original DOM position to preserve template structure
    try {
      if (el._movedToBody && el._origParent && el._placeholder) {
        el._origParent.insertBefore(el, el._placeholder);
        el._placeholder.remove();
        el._placeholder = null;
        el._origParent = null;
        el._origNext = null;
        el._movedToBody = false;
      }
    } catch(_){}
  }

  // Main click event handler
  document.addEventListener('click', (e) => {
    // Modal open/close handlers
    const openBtn = e.target.closest('[data-modal-open]');
    if (openBtn) {
      e.preventDefault();
      const id = openBtn.getAttribute('data-modal-open');
      const modal = document.getElementById(id);
      if (modal) openModal(modal);
      return;
    }

    const closeBtn = e.target.closest('[data-modal-close]');
    if (closeBtn) {
      e.preventDefault();
      const modal = closeBtn.closest('[data-modal]');
      if (modal) closeModal(modal);
      return;
    }

    const modalEl = e.target.closest('[data-modal]');
    if (modalEl && (e.target === modalEl)) {
      // Click only on the dark backdrop closes; clicks inside overlay content do not
      closeModal(modalEl);
      return;
    }

    // Copy-to-clipboard buttons
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      e.preventDefault();
      const text = copyBtn.getAttribute('data-copy');
      if (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {});
        } else {
          const t = document.createElement('textarea');
          t.value = text;
          document.body.appendChild(t);
          t.select();
          try { document.execCommand('copy'); } catch (_) {}
          document.body.removeChild(t);
        }
        copyBtn.classList.add('ring-1','ring-emerald-300');
        setTimeout(() => copyBtn.classList.remove('ring-1','ring-emerald-300'), 500);
      }
      return;
    }

    // 'Open' toggle for details (accordion) - FIXED SECTION
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      // Prevent any other document-level click handlers from interfering
      e.preventDefault();
      e.stopImmediatePropagation();
      
      const id = toggle.getAttribute('data-toggle');
      const target = document.getElementById(id);
      
      if (!target) {
        console.warn('Toggle target not found:', id);
        return;
      }

      const isOpen = !target.classList.contains('hidden');
      
      if (isOpen) {
        // Close the section
        collapseSection(target);
        setLinkedVisibility(id, false);
        toggle.setAttribute('aria-expanded', 'false');
        const icon = toggle.querySelector('svg');
        if (icon) icon.style.transform = 'rotate(0deg)';
        
        // De-elevate card when closing and show large ribbon/status chip again
        const card = toggle.closest('.group');
        if (card){
          card.classList.remove('ring-1','ring-blue-300/40','shadow-md','md:p-7');
          // remove transform enlargement styles
          card.style.transform = '';
          card.style.zIndex = '';
          // restore hover translate if we removed it
          if (card._hoverRemoved){ 
            card.classList.add('hover:-translate-y-1'); 
            card._hoverRemoved = false; 
          }
          const rib = card.querySelector('[data-ribbon]');
          if (rib) rib.classList.remove('hidden');
          const chip = card.querySelector('[data-status-chip]');
          if (chip) chip.classList.remove('hidden');
        }
      } else {
        // Open the section
        closeOtherAccordions(id);
        expandSection(target);
        setLinkedVisibility(id, true);
        toggle.setAttribute('aria-expanded', 'true');
        const icon = toggle.querySelector('svg');
        if (icon) icon.style.transform = 'rotate(180deg)';
        
        // Elevate card subtly and hide big ribbon/status chip when open
        const card = toggle.closest('.group');
        if (card){
          card.classList.add('ring-1','ring-blue-300/40','shadow-md');
          try { 
            card._hoverRemoved = card.classList.contains('hover:-translate-y-1'); 
            card.classList.remove('hover:-translate-y-1'); 
          } catch(_){}
          const rib = card.querySelector('[data-ribbon]');
          if (rib) rib.classList.add('hidden');
          const chip = card.querySelector('[data-status-chip]');
          if (chip) chip.classList.add('hidden');
        }
      }
      return;
    }
  });

  // Intercept submits in capture phase to beat inline onsubmit
  document.addEventListener('submit', function(e){
    const form = e.target.closest('form');
    if (!form) return;
    const action = form.getAttribute('action') || '';
    if (!/artist-applications\/.+\/(approve|reject)\//.test(action)) return;
    e.preventDefault();
    const isApprove = /approve\//.test(action);
    const scope = form.closest('[data-card-overlay]') || document.body;
    showConfirm(scope, isApprove ? 'Approve this application?' : 'Reject this application?').then(function(ok){
      if (!ok) return;
      const btn = form.querySelector('button');
      if (btn){ btn.disabled = true; btn.classList.add('opacity-60'); btn.textContent = isApprove ? 'Approving…' : 'Rejecting…'; }
      const csrf = form.querySelector('input[name="csrfmiddlewaretoken"]')?.value || (document.querySelector('input[name="csrfmiddlewaretoken"]')?.value || '');
      return fetch(action, { method:'POST', headers: { 'X-CSRFToken': csrf, 'X-Requested-With':'XMLHttpRequest' }, body: new FormData(form) })
        .then(function(res){ if (res.ok) return res.text(); throw new Error('Request failed'); })
        .then(function(){
          // Update UI: hide buttons, show final badge, update header chip/ribbon
          const card = form.closest('.group');
          if (!card) return;
          // Action area
          const actions = card.querySelector('[data-details-actions] .flex');
          if (actions){ actions.innerHTML = `<span class=\"inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${isApprove?'bg-green-100 text-green-700 border border-green-200':'bg-red-100 text-red-700 border-red-200'}\">${isApprove?'Approved':'Rejected'}</span>`; }
          // Header chip
          const chip = card.querySelector('[data-status-chip]');
          if (chip) chip.classList.add('hidden');
          // Big ribbon
          const rib = card.querySelector('[data-ribbon]');
          if (rib){ rib.innerHTML = `<span class=\"inline-flex items-center px-10 py-2 rounded-md text-base font-semibold ${isApprove?'bg-green-500/90':'bg-red-600/90'} text-white shadow-lg\">${isApprove?'Approved':'Rejected'}</span>`; }
          // Modal header status chip (pending/under review/processing only) -> remove on final state
          try {
            const openModal = document.querySelector('[data-modal].flex');
            if (openModal){
              const modalChip = openModal.querySelector('[data-modal-status-chip]');
              if (modalChip) modalChip.remove();
            }
          } catch(_){ }
          // Inline toast (prefer overlay if present)
          const overlay = form.closest('[data-card-overlay]') || document.body;
          showToast(isApprove ? 'APPROVED' : 'REJECTED', isApprove ? 'success' : 'error', overlay);
        })
        .catch(function(){ const overlay = form.closest('[data-card-overlay]') || document.body; showToast('Action failed. Please refresh and try again.', 'error', overlay); })
        .finally(function(){ if (btn){ btn.disabled = false; btn.classList.remove('opacity-60'); btn.textContent = isApprove ? 'Approve' : 'Reject'; } });
    });
  });

  // Sticky tabs shadow on scroll + refresh spinner
  const tabsBar = document.getElementById('apps-tabs-bar');
  if (tabsBar) {
    const onScroll = () => {
      const scrolled = window.scrollY > 0;
      tabsBar.classList.toggle('shadow-sm', scrolled);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const refreshLink = document.getElementById('appsRefresh');
  if (refreshLink) {
    refreshLink.addEventListener('click', () => {
      const spinner = refreshLink.querySelector('[data-spinner]');
      if (spinner) spinner.classList.remove('hidden');
    });
  }

  // ---------- Tab badges based on summary chips (moved from template)
  function updateTabCounts(){
    try {
      const sum = document.getElementById('apps-summary');
      const bar = document.getElementById('apps-tabs-bar');
      if (!sum || !bar) return;
      const map = {};
      Array.prototype.forEach.call(sum.querySelectorAll('span'), function(s){
        const t = (s.textContent||'').trim();
        const parts = t.split(':');
        if (parts.length >= 2){
          const key = parts[0].toLowerCase();
          const val = parseInt(parts[1], 10);
          if (!isNaN(val)) map[key] = val;
        }
      });
      const setBadge = function(anchor, count){
        if (!anchor) return;
        const old = anchor.querySelector('[data-count]'); if (old) old.remove();
        const b = document.createElement('span');
        b.setAttribute('data-count','1');
        b.className = 'ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] border bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
        b.textContent = count;
        anchor.appendChild(b);
      };
      const allA = bar.querySelector('a[data-tab="all"]'); if (allA && map['total'] != null) setBadge(allA, map['total']);
      const pA = bar.querySelector('a[data-tab="pending"]'); if (pA && map['pending'] != null) setBadge(pA, map['pending']);
      const urA = bar.querySelector('a[data-tab="under_review"]'); if (urA && map['under review'] != null) setBadge(urA, map['under review']);
      const prA = bar.querySelector('a[data-tab="processing"]'); if (prA && map['processing'] != null) setBadge(prA, map['processing']);
      const apA = bar.querySelector('a[data-tab="approved"]'); if (apA && map['approved'] != null) setBadge(apA, map['approved']);
      const rA = bar.querySelector('a[data-tab="rejected"]'); if (rA && map['rejected'] != null) setBadge(rA, map['rejected']);
    } catch(_) { /* noop */ }
  }

  // ---------- AJAX tab switching (moved from template)
  (function bindTabs(){
    const bar = document.getElementById('apps-tabs-bar');
    if (!bar || bar.getAttribute('data-bound')) return;
    bar.setAttribute('data-bound','1');
    bar.addEventListener('click', async function(ev){
      const a = ev.target && (ev.target.closest && ev.target.closest('a[href]'));
      if (!a) return;
      try {
        ev.preventDefault();
        const url = new URL(a.getAttribute('href'), window.location.href);
        const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const gridNew = doc.getElementById('apps-grid');
        const grid = document.getElementById('apps-grid');
        if (gridNew && grid){ grid.innerHTML = gridNew.innerHTML; }
        const sumNew = doc.getElementById('apps-summary');
        const sum = document.getElementById('apps-summary');
        if (sumNew && sum){ sum.innerHTML = sumNew.innerHTML; }
        // Update active tab styling
        bar.querySelectorAll('a[aria-current]')?.forEach(function(x){ x.removeAttribute('aria-current'); });
        a.setAttribute('aria-current','page');
        // Recompute summary + badges after DOM swap
        renderAppSummary();
        updateTabCounts();
      } catch(_){ }
    });
  })();

  // ---------- Sidebar activation (moved from template)
  function activateSidebar(){
    try { if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar('/Super-Admin/artist-applications/'); } } catch(_){ }
  }

  // ---------- Summary chips (Total / Pending / Under Review / Processing / Approved / Rejected)
  function renderAppSummary(){
    try {
      const wrap = document.getElementById('apps-summary');
      const grid = document.getElementById('apps-grid');
      if (!wrap || !grid) return;
      const cards = Array.prototype.slice.call(grid.querySelectorAll('.group'));
      const counts = { total: 0, pending: 0, under_review: 0, processing: 0, approved: 0, rejected: 0 };
      cards.forEach((card) => {
        // Find the status badge by known badge container line (header row)
        const badge = card.querySelector('span.rounded-full');
        counts.total += 1;
        if (!badge) return;
        const txt = (badge.textContent || '').trim().toLowerCase();
        if (txt.includes('approved')) counts.approved += 1;
        else if (txt.includes('rejected')) counts.rejected += 1;
        else if (txt.includes('under review')) counts.under_review += 1;
        else if (txt.includes('processing')) counts.processing += 1;
        else if (txt.includes('pending')) counts.pending += 1;
      });
      function chip(label, cls){
        const span = document.createElement('span');
        span.className = 'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ' + cls;
        span.textContent = label;
        return span;
      }
      const frag = document.createDocumentFragment();
      frag.appendChild(chip(`Total: ${counts.total}`, 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'));
      frag.appendChild(chip(`Pending: ${counts.pending}`, 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'));
      frag.appendChild(chip(`Under Review: ${counts.under_review}`, 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300'));
      frag.appendChild(chip(`Processing: ${counts.processing}`, 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300'));
      frag.appendChild(chip(`Approved: ${counts.approved}`, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'));
      frag.appendChild(chip(`Rejected: ${counts.rejected}`, 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'));
      wrap.innerHTML = '';
      wrap.appendChild(frag);
    } catch(_) { /* noop */ }
  }

  // ---------- Initial lightweight skeleton overlay (brief)
  function showInitialSkeleton(){
    try {
      const grid = document.getElementById('apps-grid');
      if (!grid || grid.getAttribute('data-skeleton-done') === '1') return;
      const host = document.createElement('div');
      host.id = 'apps-skeleton';
      host.className = grid.className;
      const n = Math.min(6, Math.max(3, Math.ceil(window.innerWidth / 320)));
      const frag = document.createDocumentFragment();
      for (let i=0;i<n;i++){
        const sk = document.createElement('div');
        sk.className = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm animate-pulse h-[180px]';
        sk.innerHTML = `
          <div class="flex items-start gap-3">
            <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2">
            <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>`;
        frag.appendChild(sk);
      }
      // Hide real grid briefly for a smooth entrance
      grid.style.opacity = '0';
      grid.parentElement.insertBefore(host, grid);
      setTimeout(() => {
        try {
          const skel = document.getElementById('apps-skeleton');
          if (skel) skel.remove();
          grid.style.transition = 'opacity 220ms ease';
          grid.style.opacity = '1';
          grid.setAttribute('data-skeleton-done','1');
        } catch(_) { }
      }, 240);
    } catch(_) { }
  }

  // Kick in enhancements after DOM is ready
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ showInitialSkeleton(); renderAppSummary(); updateTabCounts(); activateSidebar(); });
  } else {
    showInitialSkeleton();
    renderAppSummary();
    updateTabCounts();
    activateSidebar();
  }     
})();