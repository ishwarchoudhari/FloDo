/* static/js/admin_management.js */
(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function csrf(){
    try {
      if (window.getCookie) return window.getCookie('csrftoken') || '';
      const name = 'csrftoken=';
      const parts = (document.cookie || '').split(';');
      for (let i=0;i<parts.length;i++){
        const c = parts[i].trim();
        if (c.startsWith(name)) return decodeURIComponent(c.substring(name.length));
      }
      return '';
    } catch(_){ return ''; }
  }
  function notify(msg, type){ if (window.showNotification) window.showNotification(msg, type||'info'); }
  function escapeHtml(s){ const div=document.createElement('div'); div.textContent=String(s==null?'':s); return div.innerHTML; }
  // Client-side cache and pagination (DRF-compatible)
  let __adminsCache = [];
  let __nextUrl = null; // DRF provides absolute/relative `next` URL; if present, we show Load more
  // Abort controller for list fetches to prevent piling requests during rapid typing
  let __adminFetchCtl = null;

  // Focus trap utilities (safe no-ops if anything fails)
  function getFocusable(root){
    try {
      return Array.prototype.slice.call(root.querySelectorAll(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"])'
      )).filter(function(el){ return el.offsetParent !== null || el === document.activeElement; });
    } catch(_) { return []; }
  }
  function setupFocusTrap(container){
    try {
      if (!container || container._focusTrapHandlers) return;
      const focusables = getFocusable(container);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      function onKeydown(e){
        if (e.key !== 'Tab') return;
        const f = getFocusable(container);
        const firstEl = f[0], lastEl = f[f.length-1];
        if (!firstEl || !lastEl) return;
        if (e.shiftKey){
          if (document.activeElement === firstEl){ e.preventDefault(); lastEl.focus(); }
        } else {
          if (document.activeElement === lastEl){ e.preventDefault(); firstEl.focus(); }
        }
      }
      function onFocusin(e){
        if (!container.contains(e.target)){
          const f = getFocusable(container); if (f[0]) f[0].focus();
        }
      }
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('focusin', onFocusin, true);
      // initial focus
      try { if (first) first.focus(); } catch(_){ }
      container._focusTrapHandlers = { onKeydown, onFocusin };
    } catch(_) { /* no-op */ }
  }
  function teardownFocusTrap(container){
    try {
      if (!container || !container._focusTrapHandlers) return;
      const { onKeydown, onFocusin } = container._focusTrapHandlers;
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('focusin', onFocusin, true);
      delete container._focusTrapHandlers;
    } catch(_) { /* no-op */ }
  }

  // ------------------ Recover Password Mini-Dialog ------------------
  function openRecoverPasswordDialog(u){
    const portal = qs('#admin-add-portal');
    if (!portal) { notify('Portal not found', 'error'); return; }
    portal.classList.remove('pointer-events-none');
    const host = document.createElement('div');
    host.setAttribute('data-recover-host','');
    const uname = (u.full_name||u.username||u.user_name||'').toString();
    host.innerHTML = `
      <div class="fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-[90vw] sm:w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Recover Password">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-lg font-semibold">Recover Password</h3>
              <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white text-2xl leading-none" data-cancel aria-label="Close">&times;</button>
            </div>
            <div class="px-6 py-5 space-y-5">
              <div class="rounded-lg p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 text-sm">
                <strong class="font-semibold">Caution:</strong> Changing this password will immediately update the admin’s credentials. Share the new password securely and ensure it meets your policy.
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">ID:</span><span class="font-medium">${escapeHtml(u.id)}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">Username:</span><span class="font-medium break-all">${escapeHtml(u.user_name||'—')}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">Name:</span><span class="font-medium break-all">${escapeHtml(uname)}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">City:</span><span class="font-medium">${escapeHtml(u.city||'—')}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">Phone:</span><span class="font-medium">${escapeHtml(u.phone||'—')}</span></div>
              </div>
              <div class="space-y-3">
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Enter new password</span>
                  <input type="password" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" data-new-pass autocomplete="new-password" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Confirm password</span>
                  <input type="password" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" data-confirm-pass autocomplete="new-password" />
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400">Minimum 12 characters, including upper, lower, digit, and symbol.</p>
                <p class="text-xs text-red-600 dark:text-red-400 hidden" data-error></p>
              </div>
              <div class="flex items-center justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700" data-cancel>Cancel</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" data-save disabled>Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    portal.appendChild(host);
    // Animate in
    requestAnimationFrame(function(){ const ov=qs('[data-overlay]',host); const box=qs('.transform',host); if(ov) ov.classList.add('opacity-100'); if(box){ box.classList.remove('scale-95','opacity-0'); box.classList.add('scale-100','opacity-100'); }});
    // Handlers
    const ov = qs('[data-overlay]', host);
    const btnCancel = host.querySelector('[data-cancel]');
    const btnSave = host.querySelector('[data-save]');
    const inpNew = host.querySelector('[data-new-pass]');
    const inpConf = host.querySelector('[data-confirm-pass]');
    const errEl = host.querySelector('[data-error]');
    function cleanup(){ try { teardownFocusTrap(host); host.remove(); } catch(_){} }
    function close(){ const box=qs('.transform',host); const ovl=qs('[data-overlay]',host); if(ovl) ovl.classList.remove('opacity-100'); if(box){ box.classList.remove('scale-100','opacity-100'); box.classList.add('scale-95','opacity-0'); } setTimeout(cleanup,200); }
    function validate(){
      try {
        const p = (inpNew.value||''); const c = (inpConf.value||'');
        const ok_len = p.length >= 12;
        const ok_up = /[A-Z]/.test(p);
        const ok_low = /[a-z]/.test(p);
        const ok_dig = /\d/.test(p);
        const ok_sym = /[^A-Za-z0-9]/.test(p);
        const ok_match = p === c && p.length>0;
        const policy = ok_len && ok_up && ok_low && ok_dig && ok_sym;
        const ok = policy && ok_match;
        if (btnSave) btnSave.disabled = !ok;
        if (!ok_match && (p||c)) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); }
        else if ((p||'').length && !policy) { errEl.textContent = 'Password too weak. Follow the policy.'; errEl.classList.remove('hidden'); }
        else { errEl.textContent=''; errEl.classList.add('hidden'); }
      } catch(_){ }
    }
    if (inpNew) inpNew.addEventListener('input', validate);
    if (inpConf) inpConf.addEventListener('input', validate);
    if (ov) ov.addEventListener('click', close);
    // Bind all cancel buttons (header X and footer Cancel)
    try { host.querySelectorAll('[data-cancel]').forEach(function(btn){
      btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); close(); });
    }); } catch(_){ if (btnCancel) btnCancel.addEventListener('click', close); }
    document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ document.removeEventListener('keydown', onKey); close(); } });
    if (btnSave) btnSave.addEventListener('click', async function(){
      try {
        const p = (inpNew && inpNew.value) || '';
        const c = (inpConf && inpConf.value) || '';
        if (!p || p !== c) { notify('Passwords must match', 'error'); return; }
        // Spinner state
        const orig = btnSave.innerHTML; btnSave.disabled = true; btnSave.classList.add('opacity-70','cursor-wait');
        btnSave.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>Saving...';
        const fd = new FormData(); fd.append('_method','PUT'); fd.append('action','recover_password'); fd.append('password', p);
        const doFetch = () => fetch(`/dashboard/api/admins/${u.id}/`, { method:'POST', headers: { 'X-CSRFToken': csrf() }, body: fd });
        const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
        let data = null; try { data = await res.json(); } catch(_){ data = res.ok ? {success:true}: {success:false}; }
        if (res.ok && data && data.success){
          notify(`Password changed for ${(u.full_name||u.username||u.user_name||u.id)}`, 'success');
          try { if (typeof window.bumpNotificationsNow==='function') window.bumpNotificationsNow(); } catch(_){ }
          close();
        } else {
          notify((data && data.error) || `Failed (HTTP ${res.status})`, 'error');
          btnSave.innerHTML = orig; btnSave.classList.remove('opacity-70','cursor-wait'); btnSave.disabled = false;
        }
      } catch(err){
        notify('Network error', 'error');
        btnSave.innerHTML = 'Save'; btnSave.classList.remove('opacity-70','cursor-wait'); btnSave.disabled = false;
      }
    });
    // Focus management
    try { inpNew && inpNew.focus(); } catch(_){ }
    setupFocusTrap(host);
  }

  async function fetchAdmins(q){
    const url = new URL('/dashboard/api/admins/', window.location.origin);
    if (q) url.searchParams.set('q', q);
    try {
      // Cancel any in-flight request before starting a new one
      try { if (__adminFetchCtl) { __adminFetchCtl.abort(); } } catch(_){ }
      __adminFetchCtl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        signal: (__adminFetchCtl && __adminFetchCtl.signal) || undefined,
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error('Failed to load admins');
      return res.json();
    } finally {
      // Release controller after completion
      try { __adminFetchCtl = null; } catch(_){ }
    }
  }

  // Remove a card from UI and cache by id
  function removeAdminFromUI(id){
    try {
      const grid = qs('#admin-card-grid');
      if (grid){
        const card = grid.querySelector(`[data-id="${id}"]`);
        if (card) card.remove();
      }
    } catch(_){ }
    try {
      if (Array.isArray(__adminsCache)){
        __adminsCache = __adminsCache.filter(function(x){ return String(x && x.id) !== String(id); });
      }
    } catch(_){ }
  }

  // ------------------ Big Confirmation Dialog Helper ------------------
  function openConfirmDialog(opts){
    opts = opts || {};
    const title = opts.title || 'Confirm';
    const message = opts.message || 'Are you sure?';
    const confirmText = opts.confirmText || 'Confirm';
    const confirmClass = opts.confirmClass || 'bg-blue-600 hover:bg-blue-700';
    const onConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : null; // optional async handler
    const portal = qs('#admin-add-portal');
    if (!portal) { notify('Portal not found', 'error'); return Promise.resolve(false); }
    portal.classList.remove('pointer-events-none');
    // Create a host that sits on top of any existing modal content in the same portal
    const host = document.createElement('div');
    host.setAttribute('data-confirm-host','');
    host.innerHTML = `
      <div class="fixed inset-0 z-[60] bg-black/50 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-3">
        <div class="w-full max-w-2xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(title)}</h3>
              <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white" data-cancel aria-label="Close">&times;</button>
            </div>
            <div class="px-6 py-5">
              <p class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(message)}</p>
              <div class="mt-6 flex items-center gap-3 justify-end">
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-cancel>Cancel</button>
                <button type="button" class="px-4 py-2 rounded-lg text-white ${confirmClass}" data-confirm>${escapeHtml(confirmText)}</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    portal.appendChild(host);
    return new Promise(function(resolve){
      requestAnimationFrame(function(){
        const ov = qs('[data-overlay]', host);
        const box = qs('.transform', host);
        if (ov) ov.classList.add('opacity-100');
        if (box){ box.classList.remove('scale-95','opacity-0'); box.classList.add('scale-100','opacity-100'); }
      });
      function cleanup(val){
        const ov = qs('[data-overlay]', host);
        const box = qs('.transform', host);
        if (ov) ov.classList.remove('opacity-100');
        if (box){ box.classList.remove('scale-100','opacity-100'); box.classList.add('scale-95','opacity-0'); }
        setTimeout(function(){ try { host.remove(); } catch(_) {} resolve(val); }, 200);
      }
      function onEsc(e){ if (e.key === 'Escape') { document.removeEventListener('keydown', onEsc); cleanup(false); } }
      document.addEventListener('keydown', onEsc);
      const overlay = qs('[data-overlay]', host);
      if (overlay) overlay.addEventListener('click', function(){ document.removeEventListener('keydown', onEsc); cleanup(false); });
      const btnCancel = host.querySelector('[data-cancel]');
      const btnConfirm = host.querySelector('[data-confirm]');
      if (btnCancel) btnCancel.addEventListener('click', function(){ document.removeEventListener('keydown', onEsc); cleanup(false); });
      if (btnConfirm) btnConfirm.addEventListener('click', async function(){
        document.removeEventListener('keydown', onEsc);
        if (onConfirm){
          try {
            // Visual loading state
            const originalHtml = btnConfirm.innerHTML;
            btnConfirm.disabled = true;
            btnConfirm.classList.add('opacity-70','cursor-wait','pointer-events-none');
            btnConfirm.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>' + escapeHtml(confirmText || 'Please wait…');
            const ok = await onConfirm();
            btnConfirm.innerHTML = originalHtml;
            btnConfirm.classList.remove('opacity-70','cursor-wait','pointer-events-none');
            btnConfirm.disabled = false;
            cleanup(!!ok);
            return;
          } catch(err){
            console.error('Confirm onConfirm error:', err);
            notify((err && err.message) ? String(err.message) : 'Action failed', 'error');
            cleanup(false);
            return;
          }
        }
        cleanup(true);
      });
      // Focus management scoped to host
      try { if (btnConfirm) btnConfirm.focus(); } catch(_){ }
      setupFocusTrap(host);
    });
  }

  // ------------------ Profile Dialog (Expanded Card as Modal) ------------------
  function openProfileOverlay(u, cardEl){
    const portal = qs('#admin-add-portal');
    if (!portal) { notify('Portal not found', 'error'); return Promise.resolve(); }
    // Add animated left-border highlight to the originating card
    try { cardEl.classList.add('transition-all','duration-500','border-l-4','border-indigo-500'); } catch(_){ }
    portal.classList.remove('pointer-events-none');
    // Skeleton + Details view (non-edit)
    const skeleton = `
      <div class="fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-[90vw] sm:w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-card text-card-foreground border-border bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Loading profile">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div class="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div class="px-6 py-8 space-y-6">
              <div class="grid sm:grid-cols-2 gap-6">
                <div class="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-4 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div class="pt-6 flex items-center gap-3 justify-center">
                <div class="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    const content = `
      <div class="fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-[90vw] sm:w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-card text-card-foreground border-border bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Admin profile">
            <div class="px-6 py-2 relative border-b border-gray-100 dark:border-gray-700">
              <div class="grid grid-cols-3 items-center">
                <div class="justify-self-start text-2xl font-extrabold">${escapeHtml(u.full_name || u.username)}</div>
                <div class="justify-self-center">
                  <span class="inline-flex items-center text-sm px-3 py-1.5 rounded-full ${u.status==='online'?'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300':'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}">${escapeHtml(u.role||'Admin')} • ${u.status==='online'?'Online':'Offline'}</span>
                </div>
                <div class="justify-self-end flex items-center gap-2 relative">
                  <button type="button" class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-haspopup="menu" aria-expanded="false" aria-label="Options" data-menu-trigger>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  </button>
                  <div class="absolute right-0 top-10 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 hidden" data-menu>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" data-mode="edit">${svgIcon('edit')}<span>Edit</span></button>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" data-act="pause">${svgIcon('pause')}<span>Pause</span></button>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" data-act="delete">${svgIcon('trash')}<span>Delete</span></button>
                  </div>
                  <button type="button" class="p-1.5 rounded-full text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-3xl leading-none" title="Close" aria-label="Close" data-close>&times;</button>
                </div>
              </div>
            </div>
            <div class="px-6 py-8 space-y-8" data-view>
              ${u.updated_at ? `<div class=\"text-xs text-gray-500 dark:text-gray-400\">Last updated: ${timeSince(new Date(u.updated_at))} ago</div>` : ''}
              <div class="space-y-6">
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Personal Info</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">ID:</span><span class="text-base font-medium">${escapeHtml(u.id)}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Username:</span><span class="text-base font-medium break-all">${escapeHtml(u.user_name||'—')}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Email:</span><span class="text-base font-medium break-all">${escapeHtml(u.email||'—')}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Phone:</span><span class="text-base font-medium">${escapeHtml(u.phone||'—')}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">City:</span><span class="text-base font-medium">${escapeHtml(u.city||'—')}</span></div>
                  </div>
                </div>
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Account Details</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Created:</span><span class="text-base font-medium">${u.date_joined ? timeSince(new Date(u.date_joined)) + ' ago' : '—'}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Updated:</span><span class="text-base font-medium">${u.updated_at ? timeSince(new Date(u.updated_at)) + ' ago' : '—'}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Password:</span><span class="text-base font-medium tracking-widest">********</span></div>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-extra-fields></div>
              </div>
              <div class="pt-6 flex flex-wrap items-center justify-center gap-3" data-actions>
                <button class="px-4 py-2 text-base rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500 flex items-center gap-2" data-act="message" aria-label="Message">${svgIcon('chat')}<span>Message</span><span class="hidden md:inline"> (${escapeHtml(u.user_name||u.username||'')})</span></button>
                <button class="px-4 py-2 text-base rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600" type="button" data-act="recover" aria-label="Recover Password">Recover Password</button>
              </div>
            </div>
            <form class="px-6 py-8 space-y-8 hidden" data-edit-form>
              <div class="space-y-6">
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Personal Info</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label class="block w-full text-base"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">Name</span>
                      <input name="username" type="text" value="${escapeHtml(u.full_name || u.username || '')}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                    </label>
                    <label class="block w-full text-base"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">City</span>
                      <input name="city" type="text" value="${escapeHtml(u.city||'')}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                    </label>
                    <label class="block w-full text-base"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">Phone</span>
                      <input name="phone" type="tel" value="${escapeHtml(u.phone||'')}" pattern="\\d{10}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                    </label>
                    <label class="block w-full text-base md:col-span-2"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">Role</span>
                      <select name="role" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                        <option value="admin" ${String(u.role||'').toLowerCase()==='admin'?'selected':''}>Admin</option>
                        <option value="user" ${String(u.role||'').toLowerCase()==='user'?'selected':''}>User</option>
                        <option value="super" ${String(u.role||'').toLowerCase()==='super'?'selected':''}>Super</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div class="pt-2 grid grid-cols-2 gap-3">
                <button type="submit" class="px-4 py-2 text-base rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500">Save</button>
                <button type="button" class="px-4 py-2 text-base rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-cancel>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>`;
    // Render skeleton, then swap to content shortly for perception
    portal.innerHTML = skeleton;
    // Animate in
    requestAnimationFrame(function(){
      const ov = qs('[data-overlay]', portal);
      const box = qs('.transform', portal);
      if (ov) ov.classList.add('opacity-100');
      if (box){ box.classList.remove('scale-95','opacity-0'); box.classList.add('scale-100','opacity-100'); }
    });
    // Swap skeleton -> content after a short delay for visible skeleton
    setTimeout(function(){
      portal.innerHTML = content;
      requestAnimationFrame(function(){
        const ov2 = qs('[data-overlay]', portal);
        const box2 = qs('.transform', portal);
        if (ov2) ov2.classList.add('opacity-100');
        if (box2){ box2.classList.remove('scale-95','opacity-0'); box2.classList.add('scale-100','opacity-100'); }
      });
      // Populate any additional fields coming from backend safely
      try { populateExtraFields(u, portal); } catch(_){ }
      bindProfileOverlayHandlers();
    }, 120);
    function bindProfileOverlayHandlers(){
      // Close handlers
      function close(){
        const ov = qs('[data-overlay]', portal);
        const box = qs('.transform', portal);
        if (ov) ov.classList.remove('opacity-100');
        if (box){ box.classList.remove('scale-100','opacity-100'); box.classList.add('scale-95','opacity-0'); }
        // Animate left border reverse on originating card (fade color then remove width)
        try {
          if (cardEl.classList.contains('border-indigo-500')){
            cardEl.classList.remove('border-indigo-500');
            cardEl.classList.add('border-indigo-500/0');
          }
        } catch(_) { }
        setTimeout(function(){
          portal.innerHTML='';
          portal.classList.add('pointer-events-none');
          document.removeEventListener('keydown', onEsc);
          teardownFocusTrap(portal);
          try { cardEl.classList.remove('border-l-4','border-indigo-500/0','transition-all','duration-500'); } catch(_){ }
        }, 200);
      }
      function onEsc(e){ if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onEsc);
      const overlay = qs('[data-overlay]', portal);
      if (overlay) overlay.addEventListener('click', close);
      const closeBtn = qs('[data-close]', portal);
      if (closeBtn) closeBtn.addEventListener('click', close);
      // Options menu (three-dots): dropdown with outside-click close
      const trig = qs('[data-menu-trigger]', portal);
      const menu = qs('[data-menu]', portal);
      let menuOpen = false;
      function closeMenu(){
        if (!menu || !trig) return; menu.classList.add('hidden'); trig.setAttribute('aria-expanded','false'); menuOpen = false;
      }
      function toggleMenu(e){
        if (!menu || !trig) return; e && e.preventDefault();
        const willOpen = menu.classList.contains('hidden');
        if (willOpen){ menu.classList.remove('hidden'); trig.setAttribute('aria-expanded','true'); menuOpen = true; }
        else { closeMenu(); }
      }
      if (trig && menu){
        trig.addEventListener('click', toggleMenu);
        // Close on outside click
        document.addEventListener('click', function onDoc(ev){
          if (!menuOpen) return; const t = ev.target; if (trig.contains(t) || menu.contains(t)) return; closeMenu();
        });
        // Close on Escape (already handled by modal close, but keep for menu-only use)
        document.addEventListener('keydown', function onKey(ev){ if (ev.key === 'Escape'){ closeMenu(); } });
      }
      // Actions inside dialog
      const view = qs('[data-view]', portal);
      const editForm = qs('[data-edit-form]', portal);
      portal.addEventListener('click', function(e){
        const b = e.target && e.target.closest('[data-act], [data-mode]');
        // Handle Cancel from edit mode
        const cancelBtn = e.target && e.target.closest('[data-cancel]');
        if (cancelBtn){
          if (view && editForm){ editForm.classList.add('hidden'); view.classList.remove('hidden'); }
          try { setEditActive(false); } catch(_){ }
          e.preventDefault();
          return;
        }
        if (!b) return;
        e.preventDefault();
        const act = b.getAttribute('data-act');
        const mode = b.getAttribute('data-mode');
        // Close kebab menu if open
        try { const m = qs('[data-menu]', portal); if (m) m.classList.add('hidden'); const t = qs('[data-menu-trigger]', portal); if (t) t.setAttribute('aria-expanded','false'); } catch(_){ }
        // Block clicks on disabled actions during edit
        const isEditing = !!(editForm && !editForm.classList.contains('hidden'));
        if (isEditing && b.hasAttribute('data-disabled-when-edit')) { return; }
        if (act === 'message'){ close(); openMessageOverlay(u).catch(()=>{}); return; }
        if (act === 'delete'){ openConfirmDialog({
            title: 'Delete Admin',
            message: 'This will permanently delete the admin from the database and cannot be undone. Are you sure?',
            confirmText: 'Delete',
            confirmClass: 'bg-red-600 hover:bg-red-700',
            onConfirm: async function(){
              try {
                const okDel = await deleteAdmin(u.id, (u.full_name||u.username||u.user_name||'').toString());
                if (okDel) { close(); }
                return okDel;
              } catch(err){ console.error('Delete error:', err); notify('Delete failed', 'error'); return false; }
            }
          }); return; }
        if (act === 'pause'){ close(); pauseAdmin(u.id).catch(()=>{}); return; }
        if (act === 'recover'){ openRecoverPasswordDialog(u); return; }
        if (mode === 'edit'){
          if (view && editForm){ view.classList.add('hidden'); editForm.classList.remove('hidden'); try { setEditActive(true); } catch(_){ } const first = editForm.querySelector('input,select,textarea'); try { first && first.focus(); } catch(_){ } }
        }
      });
      if (editForm){
        editForm.addEventListener('submit', async function(e){
          e.preventDefault();
          const fd = new FormData(editForm);
          fd.append('_method', 'PUT');
          const phone = (fd.get('phone')||'').toString().trim();
          if (phone && !/^\d{10}$/.test(phone)) { notify('Phone must be exactly 10 digits', 'error'); return; }
          const doFetch = () => fetch(`/dashboard/api/admins/${u.id}/`, { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd });
          const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
          const data = await res.json().catch(()=>({success:false}));
          if (data && data.success){ notify('Admin updated', 'success'); try { if (typeof window.bumpNotificationsNow==='function') window.bumpNotificationsNow(); } catch(_){ } close(); await refresh(); }
          else { notify((data && data.error) || 'Update failed', 'error'); }
        });
      }
      // Focus trap
      setupFocusTrap(portal);
    }
    return Promise.resolve();
  }

  // Toggle disabled/enabled state for actions while editing
  function setEditActive(active){
    try {
      const portal = qs('#admin-add-portal');
      if (!portal) return;
      const nodes = portal.querySelectorAll('[data-disabled-when-edit]');
      nodes.forEach(function(el){
        if (active){
          el.setAttribute('aria-disabled','true');
          el.setAttribute('disabled','disabled');
          el.classList.add('opacity-50','pointer-events-none','cursor-not-allowed');
        } else {
          el.removeAttribute('aria-disabled');
          el.removeAttribute('disabled');
          el.classList.remove('opacity-50','pointer-events-none','cursor-not-allowed');
        }
      });
    } catch(_){ }
  }

  // Append any extra fields from the backend object `u` that are not explicitly rendered
  function populateExtraFields(u, portal){
    const wrap = qs('[data-extra-fields]', portal);
    if (!wrap || !u || typeof u !== 'object') return;
    const known = new Set(['id','user_name','username','full_name','email','phone','city','role','status','is_active','date_joined','created_at','updated_at','message_preview','tickets_solved','last_login','created_by','role_approved_by']);
    const entries = Object.keys(u).filter(function(k){ return !known.has(k); }).sort();
    if (!entries.length) return;
    const frag = document.createDocumentFragment();
    entries.forEach(function(k){
      const val = u[k];
      if (val === null || typeof val === 'undefined' || (typeof val === 'string' && val.trim() === '')) return;
      const pretty = formatFieldValue(k, val);
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      const label = document.createElement('span'); label.className = 'text-gray-500 dark:text-gray-400'; label.textContent = (k.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase())) + ':';
      const value = document.createElement('span'); value.className = 'font-medium break-all'; value.textContent = pretty;
      row.appendChild(label); row.appendChild(value);
      frag.appendChild(row);
    });
    wrap.appendChild(frag);
  }

  function formatFieldValue(key, val){
    try {
      if (typeof val === 'boolean') return val ? 'Yes' : 'No';
      if (typeof val === 'number') return String(val);
      if (val && typeof val === 'object'){
        if (Array.isArray(val)) return val.join(', ');
        // Object -> JSON short
        const s = JSON.stringify(val);
        return s.length > 120 ? s.slice(0,117) + '...' : s;
      }
      const s = String(val);
      // ISO date detection
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)){
        try { return timeSince(new Date(s)) + ' ago'; } catch { return s; }
      }
      return s;
    } catch { return String(val); }
  }
  async function fetchJson(url){
    const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  }

  function renderCards(results){
    const grid = qs('#admin-card-grid');
    const count = qs('#admin-count');
    if (!grid) return;
    // Use DocumentFragment to minimize reflows
    const frag = document.createDocumentFragment();
    // Add New Admin Card (+)
    frag.appendChild(buildAddCard());
    // Group: Active then Disabled (purely visual)
    const list = Array.isArray(results) ? results : [];
    const actives = list.filter(function(u){ return !!u.is_active; });
    const disabled = list.filter(function(u){ return !u.is_active; });
    if (actives.length){ frag.appendChild(buildSectionHeader('Active')); }
    actives.forEach(function(u){ frag.appendChild(buildProfileCard(u)); });
    if (disabled.length){ frag.appendChild(buildSectionHeader('Disabled')); }
    disabled.forEach(function(u){ frag.appendChild(buildProfileCard(u)); });
    grid.innerHTML = '';
    grid.appendChild(frag);
    if (count) count.textContent = `${(results||[]).length} admin(s)`;
    renderLoadMore(grid);
    startAllTimers();
  }

  function buildSectionHeader(title){
    const h = document.createElement('div');
    h.setAttribute('data-role','section-header');
    h.className = 'col-span-full flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 mt-2 mb-1';
    h.innerHTML = `
      <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M7 5l5 5-5 5" />
      </svg>
      <span>${escapeHtml(String(title || ''))}</span>
    `;
    return h;
  }

  function renderLoadMore(grid){
    try {
      // Remove existing load more if any
      const prev = qs('[data-role="load-more-container"]', grid.parentElement || grid);
      if (prev) prev.remove();
      if (!__nextUrl) return; // Only show if server indicates more pages
      const wrap = document.createElement('div');
      wrap.setAttribute('data-role','load-more-container');
      wrap.className = 'flex justify-center mt-4';
      const btn = document.createElement('button');
      btn.className = 'px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm';
      btn.type = 'button';
      btn.textContent = 'Load more';
      btn.addEventListener('click', function(){ loadMore().catch(()=>{}); });
      wrap.appendChild(btn);
      // Insert after grid
      grid.parentElement.appendChild(wrap);
    } catch(_) { }
  }

  function buildAddCard(){
    const card = document.createElement('div');
    card.className = 'group relative bg-white dark:bg-gray-900 dark:border-gray-700 rounded-xl shadow-sm border hover:shadow-md transition p-4 flex items-center justify-center min-h-[180px]';
    card.innerHTML = `
      <button type="button" class="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white" data-act="add-open">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        <span class="mt-2 text-sm">Add New Admin</span>
      </button>
    `;
    const openBtn = card.querySelector('[data-act="add-open"]');
    openBtn.addEventListener('click', function(){ openAddOverlay(); });
    return card;
  }

  function openAddOverlay(){
    const portal = qs('#admin-add-portal');
    if (!portal) { notify('Portal not found', 'error'); return; }
    portal.classList.remove('pointer-events-none');
    portal.innerHTML = `
      <div class="fixed inset-0 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <h3 class="text-lg font-semibold">Add New Admin</h3>
              <div class="flex items-center gap-3">
                <button type="button" class="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-800" data-toggle-theme>Toggle Theme</button>
                <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Close" data-close>&times;</button>
              </div>
            </div>
            <form class="px-5 py-4 space-y-4" data-add-form>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Name</span>
                  <input name="username" type="text" required class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Jane Admin" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">City</span>
                  <input name="city" type="text" required class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Pune" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Phone</span>
                  <input name="phone" type="tel" required pattern="\\d{10}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="10 digits" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Password</span>
                  <input name="password" type="password" required class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Strong password" />
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Role</span>
                  <select name="role" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="super">Super</option>
                  </select>
                </label>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500">Create</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-close>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    // animate in
    requestAnimationFrame(function(){
      const ov = qs('[data-overlay]', portal);
      const boxWrap = qs('.transform', portal);
      if (ov) ov.classList.add('opacity-100');
      if (boxWrap){ boxWrap.classList.remove('scale-95','opacity-0'); boxWrap.classList.add('scale-100','opacity-100'); }
    });

    const closeBtns = qsa('[data-close]', portal);
    closeBtns.forEach(function(btn){ btn.addEventListener('click', closeAddOverlay); });
    const overlay = qs('[data-overlay]', portal);
    if (overlay) overlay.addEventListener('click', closeAddOverlay);
    document.addEventListener('keydown', escCloseOnce);

    const toggle = qs('[data-toggle-theme]', portal);
    if (toggle) toggle.addEventListener('click', function(){
      try {
        const isDark = document.documentElement.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      } catch(_){ }
    });

    const form = qs('[data-add-form]', portal);
    if (form) form.addEventListener('submit', onSubmitAddForm);
    // Focus trap for accessibility
    setupFocusTrap(portal);
  }

  function escCloseOnce(e){ if (e.key === 'Escape') { closeAddOverlay(); } }

  function closeAddOverlay(){
    const portal = qs('#admin-add-portal');
    if (!portal) return;
    const ov = qs('[data-overlay]', portal);
    const boxWrap = qs('.transform', portal);
    // animate out
    if (ov) ov.classList.remove('opacity-100');
    if (boxWrap){ boxWrap.classList.remove('scale-100','opacity-100'); boxWrap.classList.add('scale-95','opacity-0'); }
    setTimeout(function(){
      portal.innerHTML = '';
      portal.classList.add('pointer-events-none');
      document.removeEventListener('keydown', escCloseOnce);
      teardownFocusTrap(portal);
    }, 200);
  }

  async function onSubmitAddForm(e){
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const phone = (fd.get('phone')||'').toString().trim();
    if (!/^\d{10}$/.test(phone)) { notify('Phone must be exactly 10 digits', 'error'); return; }
    const doFetch = () => fetch('/dashboard/api/admins/', { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd });
    const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
    const data = await res.json().catch(()=>({success:false}));
    if (data && data.success){ notify('Admin created', 'success'); try { if (typeof window.bumpNotificationsNow==='function') window.bumpNotificationsNow(); } catch(_){ } closeAddOverlay(); await refresh(); }
    else { notify((data && data.error) || 'Create failed', 'error'); }
  }

  function buildProfileCard(u){
    const statusLabel = u.status === 'online' ? 'Online' : 'Offline';
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-900 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl shadow-sm border hover:shadow-md hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-indigo-500 transition transition-transform p-4 flex flex-col';
    card.setAttribute('data-id', String(u.id));
    const uname = (u.user_name || u.username || '').toString();
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400">ID #${u.id}</div>
          <h3 class="text-lg font-semibold">${escapeHtml(u.full_name || u.username)}</h3>
          <div class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(u.role || 'Admin')}</div>
        </div>
        <div class="text-xs sm:text-sm font-medium">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full ${u.status==='online'?'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300':'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}" title="${statusLabel}">
            ${u.status==='online' ? svgDot('green') : svgDot('red')}
            <span class="ml-1 hidden sm:inline">${statusLabel}</span>
          </span>
          <span class="block mt-1 text-center ${u.is_active? 'text-green-700 dark:text-green-400':'text-gray-500 dark:text-gray-400'}">${u.is_active? 'Active':'Disabled'}</span>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-sm">
        <div class="flex items-center gap-2"><span class="text-gray-500 dark:text-gray-400">Phone:</span><span class="font-medium">${escapeHtml(u.phone||'—')}</span></div>
      </div>
      <div class="mt-4 flex items-center gap-2">
        <button class="px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-[0.95rem] rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500 flex items-center gap-2" data-act="message" title="Message" aria-label="Message">
          ${svgIcon('chat')}<span class="hidden xs:inline">Message</span><span class="hidden md:inline"> (${escapeHtml(uname)})</span>
        </button>
      </div>
    `;
    // Bind actions
    card.addEventListener('click', function(ev){
      const btn = ev.target && ev.target.closest('[data-act]');
      const id = u.id;
      if (btn){
        const act = btn.getAttribute('data-act');
        if (act === 'message') { openMessageOverlay(u).catch(()=>{}); }
        else if (act === 'edit') { openEditOverlay(u).catch(()=>{}); }
        else if (act === 'delete') {
          openConfirmDialog({
            title: 'Delete Admin',
            message: 'This will permanently delete the admin from the database and cannot be undone. Are you sure?',
            confirmText: 'Delete',
            confirmClass: 'bg-red-600 hover:bg-red-700'
          }).then(async function(ok){ if (ok) { try { await deleteAdmin(id, (u.full_name||u.username||u.user_name||'').toString()); } catch(_){ } }});
        }
        else if (act === 'pause') { pauseAdmin(id).catch(()=>{}); }
        else if (act === 'recover') { notify('Recover Password is not available in frontend-only mode.', 'warning'); }
        return;
      }
      // Card background click opens modal-style profile overlay
      openProfileOverlay(u, card).catch(()=>{});
    });
    return card;
  }

  async function editAdmin(id){ /* legacy no-op preserved for compatibility */ }

  function openEditOverlay(u){
    const portal = qs('#admin-add-portal');
    if (!portal) { notify('Portal not found', 'error'); return Promise.resolve(); }
    portal.classList.remove('pointer-events-none');
    portal.innerHTML = `
      <div class="fixed inset-0 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <h3 class="text-lg font-semibold">Edit Admin #${u.id}</h3>
              <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Close" data-close>&times;</button>
            </div>
            <form class="px-5 py-4 space-y-4" data-edit-form>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Name</span>
                  <input name="username" type="text" value="${escapeHtml(u.full_name || u.username || '')}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">City</span>
                  <input name="city" type="text" value="" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Leave blank to keep" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Phone</span>
                  <input name="phone" type="tel" value="${escapeHtml(u.phone||'')}" pattern="\\d{10}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">New Password</span>
                  <input name="password" type="password" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Leave blank to keep" />
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Role</span>
                  <select name="role" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                    <option value="admin" ${String(u.role||'').toLowerCase()==='admin'?'selected':''}>Admin</option>
                    <option value="user" ${String(u.role||'').toLowerCase()==='user'?'selected':''}>User</option>
                    <option value="super" ${String(u.role||'').toLowerCase()==='super'?'selected':''}>Super</option>
                  </select>
                </label>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500">Save</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-close>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    requestAnimationFrame(function(){
      const ov = qs('[data-overlay]', portal);
      const boxWrap = qs('.transform', portal);
      if (ov) ov.classList.add('opacity-100');
      if (boxWrap){ boxWrap.classList.remove('scale-95','opacity-0'); boxWrap.classList.add('scale-100','opacity-100'); }
    });
    qsa('[data-close]', portal).forEach(function(b){ b.addEventListener('click', closeAddOverlay); });
    const form = qs('[data-edit-form]', portal);
    if (form){
      form.addEventListener('submit', async function(e){
        e.preventDefault();
        const fd = new FormData(form);
        fd.append('_method', 'PUT');
        const phone = (fd.get('phone')||'').toString().trim();
        if (phone && !/^\d{10}$/.test(phone)) { notify('Phone must be exactly 10 digits', 'error'); return; }
        const doFetch = () => fetch(`/dashboard/api/admins/${u.id}/`, { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd });
        const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
        const data = await res.json().catch(()=>({success:false}));
        if (data && data.success){ notify('Admin updated', 'success'); closeAddOverlay(); await refresh(); }
        else { notify((data && data.error) || 'Update failed', 'error'); }
      });
    }
    // Focus trap for accessibility
    setupFocusTrap(portal);
    return Promise.resolve();
  }

  async function deleteAdmin(id, name){
    const fd = new FormData();
    fd.append('_method', 'DELETE');
    const doFetch = () => fetch(`/dashboard/api/admins/${id}/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf() },
      body: fd,
    });
    let res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
    let data = null;
    try { data = await res.json(); }
    catch(_) { data = res.ok ? { success: true } : { success: false }; }

    // Fallback: try actual HTTP DELETE if POST override wasn't accepted
    if (!(res.ok && data && data.success)){
      try {
        res = await fetch(`/dashboard/api/admins/${id}/`, { method: 'DELETE', headers: { 'X-CSRFToken': csrf() } });
        try { data = await res.json(); } catch(_){ data = res.ok ? { success: true } : { success: false }; }
      } catch(_){ /* network error, handled below */ }
    }

    if (res.ok && data && data.success){
      const who = (name || '').toString().trim();
      notify(`Admin/user ${who || id} Deleted Successfully`, 'success');
      try { if (typeof window.bumpNotificationsNow==='function') window.bumpNotificationsNow(); } catch(_){ }
      // Optimistically remove from UI immediately
      try { removeAdminFromUI(id); } catch(_){ }
      await refresh();
      return true;
    } else {
      let msg = 'Delete failed';
      if (data && data.error) msg = data.error;
      else if (!res.ok) msg = `Delete failed (HTTP ${res.status})`;
      notify(msg, 'error');
      return false;
    }
  }

  async function pauseAdmin(id){
    if (!await openConfirmDialog({
      title: 'Pause Admin',
      message: 'Are you sure you want to pause this admin?',
      confirmText: 'Pause',
      confirmClass: 'bg-yellow-600 hover:bg-yellow-700'
    })) return;
    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('action', 'pause');
    const doFetch = () => fetch(`/dashboard/api/admins/${id}/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf() },
      body: fd,
    });
    const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
    const data = await res.json();
    if (data && data.success){ notify('Admin paused', 'success'); try { if (typeof window.bumpNotificationsNow==='function') window.bumpNotificationsNow(); } catch(_){ } await refresh(); }
    else { notify((data && data.error) || 'Pause failed', 'error'); }
  }

  async function refresh(){
    const grid = qs('#admin-card-grid');
    if (grid) showSkeletons(grid, 8);
    const q = (qs('#admin-search') && qs('#admin-search').value.trim()) || '';
    __adminsCache = [];
    __nextUrl = null;
    const data = await fetchAdmins(q);
    // DRF-style pagination detection
    if (data && (Array.isArray(data.results) || typeof data.results === 'object')){
      __adminsCache = (data.results || []).slice();
      __nextUrl = data.next || null;
      renderCards(__adminsCache);
    } else if (data && data.success){
      __adminsCache = (data.results || []).slice();
      __nextUrl = null;
      renderCards(__adminsCache);
    } else {
      // Unknown shape; try to read as array directly
      const arr = Array.isArray(data) ? data : [];
      __adminsCache = arr.slice();
      __nextUrl = null;
      renderCards(__adminsCache);
    }
  }

  async function loadMore(){
    if (!__nextUrl) return;
    try {
      const grid = qs('#admin-card-grid');
      if (grid) showSkeletons(grid, 4);
      const data = await fetchJson(__nextUrl);
      const pageResults = (data && data.results) ? data.results : [];
      __nextUrl = (data && data.next) ? data.next : null;
      // Append new items to cache and DOM without full re-render
      __adminsCache = __adminsCache.concat(pageResults);
      // Append cards
      const frag = document.createDocumentFragment();
      (pageResults||[]).forEach(function(u){ frag.appendChild(buildProfileCard(u)); });
      if (grid){
        // Remove skeletons (grid inner replaced earlier, so append directly)
        grid.appendChild(frag);
        renderLoadMore(grid);
      }
    } catch(_){ notify('Failed to load more', 'error'); }
  }

  // Live timers
  let timerHandle = null;
  function startAllTimers(){
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    timerHandle = setInterval(function(){
      qsa('[data-last-login]').forEach(function(el){
        const v = el.getAttribute('data-last-login');
        if (!v) { el.textContent = '—'; return; }
        const d = new Date(v);
        if (isNaN(d.getTime())) { el.textContent = '—'; return; }
        el.textContent = timeSince(d);
      });
    }, 1000);
  }
  function timeSince(date){
    const now = new Date();
    const s = Math.max(0, Math.floor((now - date)/1000));
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    const parts = [];
    if (h) parts.push(h+'h');
    if (h || m) parts.push(m+'m');
    parts.push(sec+'s');
    return parts.join(' ');
  }

  function bind(){
    const root = qs('#admin-mgmt-root');
    if (!root || root.getAttribute('data-initialized')==='1') return;
    const refreshBtn = qs('#admin-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function(){ refresh().catch(()=>{}); });
    const search = qs('#admin-search');
    if (search) search.addEventListener('input', debounce(function(){ refresh().catch(()=>{}); }, 250));
    root.setAttribute('data-initialized','1');
    refresh().catch(function(){ notify('Failed to load admins', 'error'); });

    // Polling for status updates every 60s
    if (!root._poller){
      root._poller = setInterval(function(){ refresh().catch(()=>{}); }, 60000);
    }

    // Real-time updates via WebSocket (falls back to 60s polling)
    try {
      if (!root._ws_init){
        root._ws_init = true;
        const proto = (location.protocol === 'https:') ? 'wss' : 'ws';
        const endpoint = `${proto}://${location.host}/ws/notifications/`;
        let ws = null;
        let reconnectDelay = 1000; // backoff start 1s
        const maxDelay = 20000;    // cap at 20s
        let lastRefreshAt = 0;

        function scheduleReconnect(){
          const delay = reconnectDelay;
          reconnectDelay = Math.min(maxDelay, Math.floor(reconnectDelay * 1.8));
          setTimeout(connect, delay);
        }

        function maybeRefresh(){
          const now = Date.now();
          if (now - lastRefreshAt < 800) return; // debounce bursts
          lastRefreshAt = now;
          refresh().catch(()=>{});
        }

        function connect(){
          try {
            ws = new WebSocket(endpoint);
            ws.onopen = function(){
              reconnectDelay = 1000;
              // Pause 60s poller while WS is connected for snappier UX
              try { if (root._poller) { clearInterval(root._poller); root._poller = null; } } catch(_){ }
              try { window.__adminMgmtWS = ws; } catch(_){}
            };
            ws.onmessage = function(evt){
              try {
                const msg = JSON.parse(evt.data || '{}');
                if (msg && msg.type === 'activity_log'){
                  const p = msg.data || {};
                  // Only refresh Admin Management on Table1-related events when detectable
                  const tn = (p.table_name || '').toString();
                  if (tn === 'Table1' || /admin/i.test(tn)) {
                    maybeRefresh();
                  } else {
                    // Unknown table name; very low frequency fallback
                    // Do not spam refresh for unrelated tables
                  }
                }
              } catch(_){ }
            };
            ws.onerror = function(){ /* keep silent */ };
            ws.onclose = function(){
              // Resume 60s polling when WS drops
              try { if (!root._poller) root._poller = setInterval(function(){ refresh().catch(()=>{}); }, 60000); } catch(_){ }
              try { if (window.__adminMgmtWS === ws) { window.__adminMgmtWS = null; } } catch(_){}
              scheduleReconnect();
            };
          } catch(_){ scheduleReconnect(); }
        }

        // Stagger slightly after initial fetch
        setTimeout(connect, 300);
      }
    } catch(_){ /* ignore: polling remains */ }
  }

  function debounce(fn, wait){ let t; return function(){ const ctx=this, args=arguments; clearTimeout(t); t=setTimeout(function(){ fn.apply(ctx,args); }, wait); }; }

  // Expose initializer for AJAX-injected partials
  window.initAdminManagement = function(){ try { bind(); } catch(_){} };

  // ------------------ Helpers: SVGs and Skeletons ------------------
  function svgDot(color){
    const cls = color === 'green' ? 'text-green-600' : 'text-red-600';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${cls}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="6" /></svg>`;
  }
  function svgIcon(name){
    switch(name){
      case 'chat':
        return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 5.75A2.75 2.75 0 014.75 3h14.5A2.75 2.75 0 0122 5.75v8.5A2.75 2.75 0 0119.25 17H8.664l-3.66 3.05A1 1 0 013 19.25V17H4.75A2.75 2.75 0 012 14.25v-8.5z"/></svg>';
      case 'edit':
        return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>';
      case 'trash':
        return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 7h12v2H6V7zm1 3h10l-1 10H8L7 10zm3-5h4v2h-4V5z"/></svg>';
      case 'pause':
        return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
      default:
        return '';
    }
  }
  function showSkeletons(root, n){
    try {
      const frag = document.createDocumentFragment();
      for (let i=0;i<n;i++){
        const sk = document.createElement('div');
        sk.className = 'rounded-xl border shadow-sm p-4 bg-white dark:bg-gray-900 dark:border-gray-700 animate-pulse';
        sk.innerHTML = `
          <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="mt-3 space-y-2">
            <div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2">
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>`;
        frag.appendChild(sk);
      }
      root.innerHTML = '';
      root.appendChild(frag);
    } catch(_) { }
  }
})();
