/* static/js/admin_management.js */
(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function csrf(){ return (window.getCookie && window.getCookie('csrftoken')) || ''; }
  function notify(msg, type){ if (window.showNotification) window.showNotification(msg, type||'info'); }
  function escapeHtml(s){ const div=document.createElement('div'); div.textContent=String(s==null?'':s); return div.innerHTML; }

  async function fetchAdmins(q){
    const url = new URL('/dashboard/api/admins/', window.location.origin);
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (!res.ok) throw new Error('Failed to load admins');
    return res.json();
  }

  function renderCards(results){
    const grid = qs('#admin-card-grid');
    const count = qs('#admin-count');
    if (!grid) return;
    grid.innerHTML = '';

    // Add New Admin Card (+)
    grid.appendChild(buildAddCard());

    (results||[]).forEach(function(u){
      grid.appendChild(buildProfileCard(u));
    });
    if (count) count.textContent = `${(results||[]).length} admin(s)`;
    startAllTimers();
  }

  function buildAddCard(){
    const card = document.createElement('div');
    card.className = 'group relative bg-white rounded-xl shadow-sm border hover:shadow-md transition p-4 flex items-center justify-center min-h-[180px]';
    card.innerHTML = `
      <button type="button" class="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-gray-800" data-act="add-open">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        <span class="mt-2 text-sm">Add New Admin</span>
      </button>
      <form class="hidden w-full space-y-2" data-add-form>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input name="username" type="text" required placeholder="Name" class="border rounded px-3 py-2" />
          <input name="city" type="text" required placeholder="City" class="border rounded px-3 py-2" />
          <input name="phone" type="tel" required placeholder="Phone (10 digits)" pattern="\\d{10}" class="border rounded px-3 py-2" />
          <input name="password" type="password" required placeholder="Password" class="border rounded px-3 py-2" />
          <input name="role" type="text" placeholder="Role (e.g., Admin)" class="border rounded px-3 py-2" />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-3 py-2 bg-blue-600 text-white rounded">Create</button>
          <button type="button" class="px-3 py-2 bg-gray-200 rounded" data-act="add-cancel">Cancel</button>
        </div>
      </form>
    `;
    const openBtn = card.querySelector('[data-act="add-open"]');
    const form = card.querySelector('[data-add-form]');
    const cancelBtn = card.querySelector('[data-act="add-cancel"]');
    openBtn.addEventListener('click', function(){ openBtn.classList.add('hidden'); form.classList.remove('hidden'); });
    cancelBtn.addEventListener('click', function(){ form.reset(); form.classList.add('hidden'); openBtn.classList.remove('hidden'); });
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData(form);
      // Basic client-side validation for phone
      const phone = (fd.get('phone')||'').toString().trim();
      if (!/^\d{10}$/.test(phone)) { notify('Phone must be exactly 10 digits', 'error'); return; }
      const doFetch = () => fetch('/dashboard/api/admins/', { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd });
      const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
      const data = await res.json();
      if (data && data.success){ notify('Admin created', 'success'); await refresh(); }
      else { notify((data && data.error) || 'Create failed', 'error'); }
    });
    return card;
  }

  function buildProfileCard(u){
    const onlineDot = u.status === 'online' ? '🟢' : '🔴';
    const statusLabel = u.status === 'online' ? 'Online' : 'Offline';
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-sm border hover:shadow-md transition p-4 flex flex-col';
    card.setAttribute('data-id', String(u.id));
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs text-gray-500">ID #${u.id}</div>
          <h3 class="text-lg font-semibold">${escapeHtml(u.full_name || u.username)}</h3>
          <div class="text-sm text-gray-600">${escapeHtml(u.role || 'Admin')}</div>
        </div>
        <div class="text-sm font-medium ${u.status==='online'?'text-green-600':'text-red-600'}" title="${statusLabel}">${onlineDot}</div>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-sm">
        <div class="flex items-center gap-2"><span class="text-gray-500">Phone:</span><span class="font-medium">${escapeHtml(u.phone||'—')}</span></div>
        <div class="flex items-center gap-2"><span class="text-gray-500">Status:</span><span class="font-medium capitalize">${escapeHtml(statusLabel)}</span></div>
        <div class="flex items-center gap-2"><span class="text-gray-500">Tickets Solved:</span><span class="font-medium">${Number(u.tickets_solved||0)}</span></div>
        <div class="flex items-center gap-2"><span class="text-gray-500">Login Time:</span>
          <span class="font-medium" data-last-login="${u.last_login||''}">
            ${u.last_login ? timeSince(new Date(u.last_login)) : '—'}
          </span>
        </div>
        <div class="flex items-center gap-2"><span class="text-gray-500">Role Approved by:</span><span class="font-medium">${escapeHtml(u.role_approved_by||'—')}</span></div>
        <div class="flex items-center gap-2"><span class="text-gray-500">Created By:</span><span class="font-medium">${escapeHtml(u.created_by||'—')}</span></div>
      </div>
      <div class="mt-4 flex items-center gap-2">
        <button class="px-3 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200" data-act="message" title="Message">💬</button>
        <button class="px-3 py-2 text-sm rounded bg-amber-100 hover:bg-amber-200" data-act="edit" title="Edit">✏️</button>
        <button class="px-3 py-2 text-sm rounded bg-red-100 hover:bg-red-200" data-act="delete" title="Delete">🗑️</button>
        <button class="px-3 py-2 text-sm rounded bg-yellow-100 hover:bg-yellow-200" data-act="pause" title="Pause Account">⏸️</button>
        <span class="ml-auto text-xs ${u.is_active? 'text-green-700':'text-gray-500'}">${u.is_active? 'Active':'Disabled'}</span>
      </div>
    `;
    // Bind actions
    card.addEventListener('click', function(ev){
      const btn = ev.target && ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const id = u.id;
      if (act === 'message') { notify('Messaging not implemented yet', 'info'); }
      else if (act === 'edit') { editAdmin(id).catch(()=>{}); }
      else if (act === 'delete') { deleteAdmin(id).catch(()=>{}); }
      else if (act === 'pause') { pauseAdmin(id).catch(()=>{}); }
    });
    return card;
  }

  async function editAdmin(id){
    // Simple prompt-based edit to keep UI minimal and non-invasive
    const card = qs(`[data-id='${id}']`);
    const curUser = card ? card.querySelector('h3')?.textContent.trim() : '';
    const curRole = card ? (card.querySelector('.text-sm.text-gray-600')?.textContent.trim() || 'Admin') : 'Admin';
    const curPhone = card ? (card.querySelectorAll('.font-medium')[1]?.textContent.trim() || '') : '';
    const curCity = window.prompt('City (required, letters only):', '') || '';
    const username = window.prompt('New username (leave blank to keep same):', curUser) || curUser;
    const role = window.prompt('New role (leave blank to keep same):', curRole) || curRole;
    const password = window.prompt('New password (leave blank to keep same):', '');
    const phone = window.prompt('Phone (10 digits, leave blank to keep same):', curPhone) || curPhone;
    if (phone && !/^\d{10}$/.test(phone)) { notify('Phone must be exactly 10 digits', 'error'); return; }
    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('username', username);
    fd.append('role', role);
    if (curCity) fd.append('city', curCity);
    if (phone) fd.append('phone', phone);
    if (password) fd.append('password', password);
    const doFetch = () => fetch(`/dashboard/api/admins/${id}/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf() },
      body: fd
    });
    const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
    const data = await res.json();
    if (data && data.success){ notify('Admin updated', 'success'); await refresh(); }
    else { notify((data && data.error) || 'Update failed', 'error'); }
  }

  async function deleteAdmin(id){
    if (!window.confirm('Delete this admin?')) return;
    const fd = new FormData();
    fd.append('_method', 'DELETE');
    const doFetch = () => fetch(`/dashboard/api/admins/${id}/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf() },
      body: fd
    });
    const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
    const data = await res.json();
    if (data && data.success){ notify('Admin deleted', 'success'); await refresh(); }
    else { notify((data && data.error) || 'Delete failed', 'error'); }
  }

  async function pauseAdmin(id){
    if (!window.confirm('Pause this admin account?')) return;
    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('action', 'pause');
    const doFetch = () => fetch(`/dashboard/api/admins/${id}/`, { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd });
    const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
    const data = await res.json();
    if (data && data.success){ notify('Admin paused', 'success'); await refresh(); }
    else { notify((data && data.error) || 'Pause failed', 'error'); }
  }

  async function refresh(){
    const q = (qs('#admin-search') && qs('#admin-search').value.trim()) || '';
    const data = await fetchAdmins(q);
    if (data && data.success){ renderCards(data.results || []); }
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
})();
