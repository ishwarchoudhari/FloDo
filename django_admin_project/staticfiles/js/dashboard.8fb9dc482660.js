// dashboard.js
// CRUD and data fetching for dashboard tables.

// Escape HTML special characters to mitigate XSS when using innerHTML
function esc(s){
  try {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  } catch(_) { return s; }
}

async function fetchTableData(tableId, page=1, q='') {
  const url = `/dashboard/api/table/${tableId}/?page=${page}&per_page=10&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  return res.json();
}

function updateTableDisplay(tableId, payload){
  const tbody = document.querySelector(`#table-${tableId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = '';
  (payload.results || []).forEach(row => {
    // Ensure we have a displayable unique id using frontend mapping if backend omitted it
    const fallbackKey = row.unique_id || row.id || row.pk || `${row.name}|${row.city}|${row.phone}`;
    const uid = window.getPersistentUID ? window.getPersistentUID(`t${tableId}:${fallbackKey}`) : (row.unique_id || fallbackKey);
    const realId = row.id || row.pk || row.unique_id; // backend primary key for CRUD
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 pr-2">${esc(uid)}</td>
      <td class="py-2 pr-2"><span data-field="name" class="block">${esc(row.name ?? '')}</span></td>
      <td class="py-2 pr-2"><span data-field="city" class="block">${esc(row.city ?? '')}</span></td>
      <td class="py-2 pr-2"><span data-field="phone" class="block">${esc(row.phone ?? '')}</span></td>
      <td class="py-2 pr-2 space-x-2 whitespace-nowrap">
        <button class="px-2 py-1 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700" data-action="edit" data-id="${realId}" aria-label="Edit row ${uid}">Edit</button>
        <button class="px-2 py-1 bg-red-600 text-white rounded hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600" data-action="delete" data-id="${realId}" aria-label="Delete row ${uid}">Delete</button>
        <button class="px-2 py-1 bg-blue-600 text-white rounded hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600" data-action="save" data-id="${realId}" aria-label="Save changes to row ${uid}">Save</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // Helpers for edit mode UX
  function exitEditMode(tr){
    if (!tr) return;
    tr.classList.remove('bg-yellow-50');
    // convert inputs back to spans and clear state
    tr.querySelectorAll('td').forEach(td => {
      const input = td.querySelector('input[data-field]');
      if (input) {
        const val = input.value;
        const field = input.dataset.field;
        // Rebuild using DOM to avoid innerHTML
        td.innerHTML = '';
        const sp = document.createElement('span');
        sp.setAttribute('data-field', field);
        sp.className = 'block';
        sp.textContent = val;
        td.appendChild(sp);
      }
    });
    const btnEdit = tr.querySelector('button[data-action="edit"]');
    const btns = tr.querySelectorAll('button[data-action="delete"], button[data-action="save"]');
    if (btnEdit) btnEdit.classList.remove('hidden');
    btns.forEach(b => b.classList.add('hidden'));
    tr.classList.remove('editing');
  }

  function enterEditMode(tr){
    // ensure only one row is editing
    const current = tr.closest('tbody').querySelector('tr.editing');
    if (current && current !== tr) exitEditMode(current);
    tr.classList.add('editing', 'bg-yellow-50');
    // swap spans -> inputs for editable fields
    tr.querySelectorAll('span[data-field]').forEach(sp => {
      const field = sp.getAttribute('data-field');
      const val = sp.textContent || '';
      const td = sp.parentElement;
      // Build input safely
      td.innerHTML = '';
      const inp = document.createElement('input');
      inp.className = 'border rounded px-2 py-1 w-full';
      inp.value = val;
      inp.setAttribute('data-field', field);
      td.appendChild(inp);
    });
    const btnEdit = tr.querySelector('button[data-action="edit"]');
    const btns = tr.querySelectorAll('button[data-action="delete"], button[data-action="save"]');
    if (btnEdit) btnEdit.classList.add('hidden');
    btns.forEach(b => b.classList.remove('hidden'));
    // focus first input
    const first = tr.querySelector('input[data-field]');
    if (first) first.focus();
    // keyboard shortcuts
    tr.querySelectorAll('input[data-field]').forEach(i => {
      i.onkeydown = (e) => {
        e = e || window.event;
        if (e.key === 'Enter') {
          const saveBtn = tr.querySelector('button[data-action="save"]');
          if (saveBtn) saveBtn.click();
        } else if (e.key === 'Escape') {
          exitEditMode(tr);
        }
      };
    });
    // Inform global auto-refresh controller that a form is now active (pause timer)  // added
    if (typeof window.noteTablesFormActivity === 'function') window.noteTablesFormActivity();  // added
  }

  // Wire actions
  // Edit toggles read-only -> editable and reveals buttons
  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      enterEditMode(tr);
    });
  });

  // Save
  tbody.querySelectorAll('button[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.getAttribute('data-id');
      const tr = btn.closest('tr');
      const inputs = tr.querySelectorAll('input[data-field]');
      // Frontend validation: Name/City letters+spaces; Phone 10 digits
      const nameVal = tr.querySelector('input[data-field="name"]')?.value?.trim() || '';
      const cityVal = tr.querySelector('input[data-field="city"]')?.value?.trim() || '';
      const phoneVal = tr.querySelector('input[data-field="phone"]')?.value?.trim() || '';
      const nameOk = /^[A-Za-z ]+$/.test(nameVal) && nameVal.length > 0;
      const cityOk = /^[A-Za-z ]+$/.test(cityVal) && cityVal.length > 0;
      const phoneOk = /^\d{10}$/.test(phoneVal);
      if (!nameOk || !cityOk || !phoneOk){
        let msg = 'Validation failed:';
        if (!nameOk) msg += ' Name must contain only letters and spaces.';
        if (!cityOk) msg += ' City must contain only letters and spaces.';
        if (!phoneOk) msg += ' Phone must be exactly 10 digits.';
        if (typeof showNotification === 'function') showNotification('Invalid input', 'error', msg.trim());
        return;
      }
      const data = new FormData();
      inputs.forEach(i => data.append(i.dataset.field, i.value.trim()))
      // prevent double clicks
      const prevText = btn.textContent;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Saving...';
      btn.classList.add('opacity-50','cursor-not-allowed');
      const res = await updateTableRow(tableId, rowId, data);
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = prevText;
      btn.classList.remove('opacity-50','cursor-not-allowed');
      if (res.success) {
        const d = res.data || {};
        const details = `Row #${d.id || rowId}: ${[d.name||'', d.city||'', d.phone||''].filter(Boolean).join(' • ')}`;
        showNotification('Saved', 'success', details);
        // exit edit mode immediately; then refresh to reflect any server-side changes
        exitEditMode(tr);
        if (typeof refreshLogs === 'function') refreshLogs();
        // Trigger notifications bump for near-instant bell/log update
        try { if (typeof window.bumpNotificationsNow === 'function') window.bumpNotificationsNow(); } catch(_){ }
        // [AI PATCH] resume polling immediately after successful Save
        try { if (typeof window.__tablesPauseUntil !== 'undefined') { window.__tablesPauseUntil = 0; }
          if (window.__tablesInactivityTimer) { clearTimeout(window.__tablesInactivityTimer); window.__tablesInactivityTimer = null; }
        } catch(_){ }
      } else {
        showNotification('Save failed','error', res.error || '');
      }
      refreshTable(tableId);
    });
  });

  // Delete
  tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowId = btn.getAttribute('data-id');
      const ok = window.confirm('Delete row ' + rowId + '? This action cannot be undone.');
      if (!ok) return;
      const prevText = btn.textContent;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Deleting...';
      btn.classList.add('opacity-50','cursor-not-allowed');
      const res = await deleteTableRow(tableId, rowId);
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = prevText;
      btn.classList.remove('opacity-50','cursor-not-allowed');
      if (res.success) {
        const details = `Row #${rowId}`;
        showNotification('Deleted', 'success', details);
        if (typeof refreshLogs === 'function') refreshLogs();
        // Trigger notifications bump for near-instant bell/log update
        try { if (typeof window.bumpNotificationsNow === 'function') window.bumpNotificationsNow(); } catch(_){ }
        // [AI PATCH] resume polling immediately after successful Delete
        try { if (typeof window.__tablesPauseUntil !== 'undefined') { window.__tablesPauseUntil = 0; }
          if (window.__tablesInactivityTimer) { clearTimeout(window.__tablesInactivityTimer); window.__tablesInactivityTimer = null; }
        } catch(_){ }
      } else {
        showNotification('Delete failed','error', res.error || '');
      }
      refreshTable(tableId);
    });
  });

  // Per-row ADD removed; use the top add form

  const pag = document.getElementById(`pagination-${tableId}`);
  if (pag) pag.textContent = `Page ${payload.page} of ${payload.num_pages} — Total ${payload.total}`;
}

async function createTableRow(tableId, rowData){
  const doFetch = () => fetch(`/dashboard/api/table/${tableId}/row/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCookie('csrftoken'), 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
    body: rowData,
  });
  const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
  return res.json();
}

async function updateTableRow(tableId, rowId, rowData){
  // Use POST + _method=PUT for better compatibility with Django's CSRF/form parsing
  rowData = rowData || new FormData();
  rowData.append('_method', 'PUT');
  const doFetch = () => fetch(`/dashboard/api/table/${tableId}/row/${rowId}/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCookie('csrftoken'), 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
    body: rowData,
  });
  const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
  return res.json();
}

async function deleteTableRow(tableId, rowId){
  // Use POST + _method=DELETE
  const fd = new FormData();
  fd.append('_method', 'DELETE');
  const doFetch = () => fetch(`/dashboard/api/table/${tableId}/row/${rowId}/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCookie('csrftoken'), 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
    body: fd,
  });
  const res = await (window.withLoading ? window.withLoading(doFetch()) : doFetch());
  return res.json();
}

async function refreshTable(tableId){
  const q = document.getElementById(`search-${tableId}`)?.value || '';
  const payload = await fetchTableData(tableId, 1, q);
  if (payload.success) updateTableDisplay(tableId, payload);
}

// Switch current active table, sync picker UI, and load data (CSP-safe replacement for inline handlers)
function setActiveTable(value){
  try {
    const tid = parseInt(value, 10) || 1;
    const picker = document.getElementById('tablePicker');
    if (picker) picker.value = String(tid);
    // Sync custom display text and active option
    try {
      const wrapper = document.getElementById('tablePickerWrapper');
      const selectedText = document.getElementById('tablePickerSelectedText');
      const list = document.getElementById('tablePickerList');
      let labels = {};
      try { labels = JSON.parse(wrapper?.getAttribute('data-label-map') || '{}'); } catch(_) { labels = {}; }
      const label = labels[String(tid)] || (`Table ${tid}`);
      if (selectedText) selectedText.textContent = label;
      if (list) {
        list.querySelectorAll('li[role="option"]').forEach(li => {
          const v = li.getAttribute('data-value');
          li.classList.toggle('active', String(v) === String(tid));
        });
      }
      const info = document.getElementById('activeTableInfo');
      if (info) info.textContent = `Active: ${label}`;
    } catch(_){}
    // Toggle visible table card
    try {
      document.querySelectorAll('[data-table-card]').forEach(card => {
        const v = parseInt(card.getAttribute('data-table-card'), 10);
        if (v === tid) card.classList.remove('hidden'); else card.classList.add('hidden');
      });
    } catch(_){}
    if (typeof refreshTable === 'function') refreshTable(tid);
  } catch(_){}
}

function addRow(tableId){
  const nameEl = document.getElementById(`add-name-${tableId}`);
  const cityEl = document.getElementById(`add-city-${tableId}`);
  const phoneEl = document.getElementById(`add-phone-${tableId}`);
  const name = (nameEl?.value || '').trim();
  const city = (cityEl?.value || '').trim();
  const phone = (phoneEl?.value || '').trim();
  // Frontend validation
  const nameOk = /^[A-Za-z ]+$/.test(name) && name.length > 0;
  const cityOk = /^[A-Za-z ]+$/.test(city) && city.length > 0;
  const phoneOk = /^\d{10}$/.test(phone);
  if (!nameOk || !cityOk || !phoneOk){
    let msg = 'Validation failed:';
    if (!nameOk) msg += ' Name must contain only letters and spaces.';
    if (!cityOk) msg += ' City must contain only letters and spaces.';
    if (!phoneOk) msg += ' Phone must be exactly 10 digits.';
    if (typeof showNotification === 'function') showNotification('Invalid input', 'error', msg.trim());
    if (nameEl) nameEl.focus();
    return;
  }
  const data = new FormData();
  data.append('name', name || '');
  data.append('city', city || '');
  data.append('phone', phone || '');

  // Find the Add button near the inputs and guard against double submits
  const container = nameEl ? nameEl.closest('div') : null;
  const btn = container ? container.querySelector('button') : null;
  const prevText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Adding...';
    btn.classList.add('opacity-50','cursor-not-allowed');
  }
  if (nameEl) nameEl.disabled = true;
  if (cityEl) cityEl.disabled = true;
  if (phoneEl) phoneEl.disabled = true;

  createTableRow(tableId, data).then(res => {
    if (res.success) {
      const d = res.data || {};
      const details = `Row #${d.id || ''}: ${[d.name||'', d.city||'', d.phone||''].filter(Boolean).join(' • ')}`;
      showNotification('Row added', 'success', details);
      // Trigger notifications bump for near-instant bell/log update
      try { if (typeof window.bumpNotificationsNow === 'function') window.bumpNotificationsNow(); } catch(_){ }
      // [AI PATCH] resume polling immediately after successful Add
      try { if (typeof window.__tablesPauseUntil !== 'undefined') { window.__tablesPauseUntil = 0; }
        if (window.__tablesInactivityTimer) { clearTimeout(window.__tablesInactivityTimer); window.__tablesInactivityTimer = null; }
      } catch(_){ }
      refreshTable(tableId);
      if (typeof refreshLogs === 'function') refreshLogs();
      // clear inputs and focus name for quicker entry
      if (nameEl) nameEl.value = '';
      if (cityEl) cityEl.value = '';
      if (phoneEl) phoneEl.value = '';
      if (nameEl) nameEl.focus();
    } else {
      showNotification('Add failed', 'error', res.error || '');
    }
  }).catch(() => {
    showNotification('Add failed', 'error', 'Network error');
  }).finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = prevText || 'Add';
      btn.classList.remove('opacity-50','cursor-not-allowed');
    }
    if (nameEl) nameEl.disabled = false;
    if (cityEl) cityEl.disabled = false;
    if (phoneEl) phoneEl.disabled = false;
  });
}

async function refreshLogs(){
  const res = await fetch('/dashboard/api/logs/?per_page=10', { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
  const payload = await res.json();
  const tbody = document.querySelector('#logs-table tbody');
  tbody.innerHTML = '';
  (payload.results||[]).forEach(x => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 pr-2">${esc(x.timestamp)}</td>
      <td class="py-2 pr-2">${esc(x.table_name)}</td>
      <td class="py-2 pr-2">${esc(x.action)}</td>
      <td class="py-2 pr-2">${esc(x.row_id)}</td>
      <td class="py-2 pr-2">${esc(x.admin_user || '-')}</td>`;
    tbody.appendChild(tr);
  });
}

window.fetchTableData = fetchTableData;
window.updateTableDisplay = updateTableDisplay;
window.createTableRow = createTableRow;
window.updateTableRow = updateTableRow;
window.deleteTableRow = deleteTableRow;
window.refreshTable = refreshTable;
window.setActiveTable = setActiveTable;
window.addRow = addRow;
window.refreshLogs = refreshLogs;

// --- Live Search: Google-style instant filtering without page reload --- // added
// Debounce utility to avoid firing too many network requests while typing  // added
function debounce(fn, delay){  // added
  let t;  // added
  return function(){  // added
    const ctx = this, args = arguments;  // added
    clearTimeout(t);  // added
    t = setTimeout(function(){ fn.apply(ctx, args); }, delay);  // added
  };  // added
}  // added

// Single delegated listener works for both full-page and AJAX-injected partials  // added
const __handleLiveSearch = debounce(function(inputEl){  // added
  try {  // added
    if (!inputEl || !inputEl.id || inputEl.id.indexOf('search-') !== 0) return;  // added
    const tableId = parseInt(inputEl.id.slice('search-'.length), 10);  // added
    if (!isNaN(tableId)) { refreshTable(tableId); }  // added
  } catch(_){}  // added
}, 250);  // added (250ms debounce)

document.addEventListener('input', function(e){  // added
  const el = e && (e.target || e.srcElement);  // added
  if (!el || el.tagName !== 'INPUT') return;  // added
  if (el.id && el.id.indexOf('search-') === 0) {  // added
    __handleLiveSearch(el);  // added
  }  // added
});  // added

// Ensure Add/Refresh/Search buttons work via delegated handler even if inline onclick is removed for CSP  // added
document.addEventListener('click', function(e){  // added
  try {  // added
    const btn = e.target && e.target.closest('button');  // added
    if (!btn) return;  // added
    // Identify Add/Refresh/Search without relying on inline onclick  // added
    const isGreen = btn.classList && btn.classList.contains('bg-green-600');  // added
    const ocAttr = (btn.getAttribute && btn.getAttribute('onclick')) || '';  // added
    const hasAddOnclick = /addRow\s*\(/.test(ocAttr);  // added
    const hasRefreshOnclick = /refreshTable\s*\(/.test(ocAttr);  // added
    const label = (btn.textContent || '').trim().toLowerCase();  // added
    const isRefreshLabel = label === 'refresh';  // added
    const isSearchLabel = label === 'search';   // added
    if (!(isGreen || hasAddOnclick || hasRefreshOnclick || isRefreshLabel)) return;  // added

    // Derive the current table id robustly  // added
    let tid = NaN;  // added
    const card = btn.closest && btn.closest('[data-table-card]');  // added
    if (card) {  // added
      tid = parseInt(card.getAttribute('data-table-card'), 10);  // added
    }  // added
    if (isNaN(tid)) {  // added
      const oc = ocAttr;  // added
      // Try to parse from onclick patterns: addRow(parseInt('N',10)) or refreshTable(parseInt('N',10))  // added
      let m = oc.match(/addRow\s*\(\s*parseInt\(\s*'?(\d+)'?\s*,\s*10\s*\)\s*\)/);  // added
      if (!m) m = oc.match(/refreshTable\s*\(\s*parseInt\(\s*'?(\d+)'?\s*,\s*10\s*\)\s*\)/);  // added
      if (m) tid = parseInt(m[1], 10);  // added
    }  // added
    if (isNaN(tid)) {  // added
      // Fallback to the current picker value  // added
      const picker = document.getElementById('tablePicker');  // added
      if (picker) tid = parseInt(picker.value, 10);  // added
    }  // added
    if (isNaN(tid)) return;  // added

    e.preventDefault();  // added
    e.stopPropagation && e.stopPropagation();  // added
    if (isGreen || hasAddOnclick) {  // added
      if (typeof window.addRow === 'function') window.addRow(tid);  // added
    } else if (hasRefreshOnclick || isRefreshLabel) {  // added
      // Hard refresh the whole page for Refresh buttons
      try { window.location.reload(true); } catch(_) { window.location.reload(); }
    } else if (isSearchLabel) {  // added
      if (typeof window.refreshTable === 'function') window.refreshTable(tid);  // added
    }  // added
  } catch(_) { /* no-op */ }  // added
});  // added

// ---------------- Auto-refresh Pause/Resume around form activity (Add/Edit/Save) ----------------
// We pause table auto-refresh while admin is typing/editing to prevent inputs from being cleared.
// Policy: pause up to 3 minutes from last activity. Resume only when the 3-minute window elapses
// or immediately on explicit form close/submit (handled in Add/Save/Delete success handlers).
(function(){
  const MAX_PAUSE_MS = 3 * 60 * 1000;      // 3 minutes
  window.__tablesPauseUntil = 0;           // epoch ms until which refresh is paused
  window.__tablesInactivityTimer = null;   // kept for compatibility; not used for early-resume anymore

  // Public helper to mark recent form activity (focus/typing on add/edit inputs)
  window.noteTablesFormActivity = function(){
    try {
      // Extend pause window to the next 3 minutes from the latest activity.
      window.__tablesPauseUntil = Date.now() + MAX_PAUSE_MS;
      // Do not early-resume on brief inactivity; we only resume when the
      // 3-minute window ends or when a form is explicitly submitted/closed.
      if (window.__tablesInactivityTimer) { clearTimeout(window.__tablesInactivityTimer); window.__tablesInactivityTimer = null; }
    } catch(_){}
  };

  // Delegate focus and input events on add/edit fields to mark activity  // added
  document.addEventListener('focusin', function(e){  // added
    const t = e.target;  // added
    if (!t) return;  // added
    if ((t.id && t.id.indexOf('add-') === 0) || t.matches('input[data-field]')) {  // added
      window.noteTablesFormActivity();  // added
    }  // added
  });
  document.addEventListener('input', function(e){  // added
    const t = e.target;  // added
    if (!t) return;  // added
    if ((t.id && t.id.indexOf('add-') === 0) || t.matches('input[data-field]')) {  // added
      window.noteTablesFormActivity();  // added
    }  // added
  });
})();  // added

// ---------------- Full-page Tables initializer (moved from templates/dashboard/tables_full.html) ----------------
(function(){
  // 3s auto-refresh for tables and logs with unified pause/resume and race guards
  const REFRESH_MS = 3000;
  // Back-compat: use a single global pause flag so notifications can share it too
  if (typeof window.__autoPauseUntil === 'undefined') window.__autoPauseUntil = 0;
  // Keep existing alias for tables-specific references
  Object.defineProperty(window, '__tablesPauseUntil', {
    get(){ return window.__autoPauseUntil; },
    set(v){ window.__autoPauseUntil = v; }
  });

  function isPaused(){
    return Date.now() <= (window.__autoPauseUntil || 0);
  }

  // Race guards to avoid overlapping network calls
  window.__refreshTablesInFlight = false;
  window.__refreshLogsInFlight = false;

  function tickAuto(){
    try {
      if (isPaused()) return;
      var sel = document.getElementById('tablePicker');
      var tid = sel ? parseInt(sel.value, 10) : 1;
      // Refresh current table
      if (!window.__refreshTablesInFlight && typeof window.refreshTable === 'function'){
        window.__refreshTablesInFlight = true;
        Promise.resolve(window.refreshTable(tid)).catch(()=>{}).finally(()=>{ window.__refreshTablesInFlight = false; });
      }
      // Refresh logs
      if (!window.__refreshLogsInFlight && typeof window.refreshLogs === 'function'){
        window.__refreshLogsInFlight = true;
        Promise.resolve(window.refreshLogs()).catch(()=>{}).finally(()=>{ window.__refreshLogsInFlight = false; });
      }
    } catch(_) { /* no-op */ }
  }

  // Ensure we don't double-create the timer
  function startAutoRefreshTimer(){
    try {
      if (window.__tablesAutoTimer) { try { clearInterval(window.__tablesAutoTimer); } catch(_){} window.__tablesAutoTimer = null; }
      window.__tablesAutoTimer = setInterval(tickAuto, REFRESH_MS);
    } catch(_) {}
  }

  function initTablesFullPage(){
    try {
      const picker = document.getElementById('tablePicker');
      const loadBtn = document.getElementById('loadTableBtn');
      const refreshBtn = document.getElementById('refreshActiveBtn');
      const initial = picker ? picker.value : 1;
      if (typeof window.setActiveTable === 'function') window.setActiveTable(initial);
      if (loadBtn) loadBtn.addEventListener('click', ()=> window.setActiveTable(picker.value));
      if (refreshBtn) refreshBtn.addEventListener('click', ()=> { try { window.location.reload(true); } catch(_) { window.location.reload(); } });
      if (picker) picker.addEventListener('change', ()=> window.setActiveTable(picker.value));
      try { document.title = (document.title || '').replace(/\s·\s.*$/,'') + ' · Tables'; } catch(e){}
      if (typeof window.setActiveSidebar === 'function') { window.setActiveSidebar('/dashboard/tables/'); }
      // Wire custom dropdown (no new functions; inline within initializer)
      try {
        const wrapper = document.getElementById('tablePickerWrapper');
        const list = document.getElementById('tablePickerList');
        const displayBtn = document.getElementById('tablePickerDisplay');
        const selectedText = document.getElementById('tablePickerSelectedText');
        let labels = {};
        try { labels = JSON.parse(wrapper?.getAttribute('data-label-map') || '{}'); } catch(_) { labels = {}; }
        // Hydrate option labels and table card headings
        if (list) {
          list.querySelectorAll('li[role="option"]').forEach(li => {
            const v = li.getAttribute('data-value');
            const el = li.querySelector('[data-role="label"]');
            if (el) el.textContent = labels[String(v)] || (`Table ${v}`);
          });
        }
        document.querySelectorAll('[data-table-card]').forEach(card => {
          const t = parseInt(card.getAttribute('data-table-card'), 10);
          const h2 = card.querySelector('h2');
          if (h2) h2.textContent = labels[String(t)] || (`Table ${t}`);
        });
        // Show custom wrapper; hide native select for a unified UI
        if (wrapper && picker) { wrapper.classList.remove('hidden'); picker.classList.add('hidden'); }
        // Set initial selected text
        if (selectedText && picker) { selectedText.textContent = labels[String(picker.value)] || (`Table ${picker.value}`); }
        // Toggle open/close
        if (displayBtn && list) {
          displayBtn.addEventListener('click', function(){
            const isHidden = list.classList.contains('hidden');
            if (isHidden) { list.classList.remove('hidden'); displayBtn.setAttribute('aria-expanded','true'); }
            else { list.classList.add('hidden'); displayBtn.setAttribute('aria-expanded','false'); }
          });
          list.addEventListener('click', function(e){
            const li = e.target && e.target.closest('li[role="option"]');
            if (!li) return;
            const val = li.getAttribute('data-value');
            if (picker) picker.value = String(parseInt(val,10) || 1);
            if (selectedText && picker) selectedText.textContent = labels[String(picker.value)] || (`Table ${picker.value}`);
            if (typeof window.setActiveTable === 'function') window.setActiveTable(picker.value);
            list.classList.add('hidden');
            displayBtn.setAttribute('aria-expanded','false');
          });
          // Close on outside click and Esc
          document.addEventListener('click', function(e){
            try {
              const t = e.target;
              if (!t) return;
              if (wrapper && !wrapper.contains(t) && !displayBtn.contains(t)) {
                list.classList.add('hidden');
                displayBtn.setAttribute('aria-expanded','false');
              }
            } catch(_){}
          });
          document.addEventListener('keydown', function(e){
            if (e.key === 'Escape') {
              list.classList.add('hidden');
              displayBtn.setAttribute('aria-expanded','false');
            }
          });
        }
      } catch(_){}
      startAutoRefreshTimer();
      // Clear timer on unload to avoid leaks
      window.addEventListener('beforeunload', function(){
        try { if (window.__tablesAutoTimer) { clearInterval(window.__tablesAutoTimer); window.__tablesAutoTimer = null; } } catch(_){ }
      });
    } catch(_) {}
  }

  // Expose and auto-init only on full page where the picker exists
  window.initTablesFullPage = initTablesFullPage;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      if (document.getElementById('tablePicker')) initTablesFullPage();
      // Optional Admin Overview auto-init when container exists (non-intrusive)
      try { if (typeof window.initAdminOverview === 'function') window.initAdminOverview(); } catch(_){ }
    });
  } else {
    if (document.getElementById('tablePicker')) initTablesFullPage();
    try { if (typeof window.initAdminOverview === 'function') window.initAdminOverview(); } catch(_){ }
  }
})();

// ---------------- Optional Admin (Table1) Overview ----------------
(function(){
  async function fetchAdminsOverview(){
    try {
      const url = new URL('/dashboard/api/admins/', window.location.origin);
      const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.success) return data.results || [];
      return [];
    } catch(_) { return []; }
  }

  function adminStatusDot(status){
    const online = String(status||'').toLowerCase() === 'online';
    return `<span class="inline-flex items-center"><span class="w-2.5 h-2.5 rounded-full mr-2 ${online ? 'bg-green-500' : 'bg-red-500'}"></span>${online ? 'Online' : 'Offline'}</span>`;
  }

  function renderAdminOverview(list){
    const root = document.getElementById('admin-overview');
    if (!root) return;
    // Build header with action button (navigate to Admin Management)
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3 text-gray-900 dark:text-gray-100';
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold';
    title.textContent = 'Admins Overview';
    const btn = document.createElement('a');
    btn.className = 'px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900';
    btn.href = '/dashboard/Admin_management/';
    btn.textContent = 'Admin Management';
    header.appendChild(title);
    header.appendChild(btn);

    // Empty state when list is missing or has no entries (e.g., no data or insufficient permissions)
    if (!list || list.length === 0) {
      root.innerHTML = '';
      root.appendChild(header);
      const empty = document.createElement('div');
      empty.className = 'text-sm text-gray-500';
      empty.textContent = 'No admins to display. You may not have permission or there is no data yet.';
      root.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
    (list || []).forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition p-4 cursor-pointer';
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.addEventListener('click', function(){ window.location.href = '/dashboard/Admin_management/'; });
      card.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = '/dashboard/Admin_management/'; } });
      const name = item.full_name || item.username || '';
      const uname = item.user_name || '';
      const status = item.status || 'offline';
      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">ID #${esc(item.id)}</div>
            <div class="text-base font-semibold text-gray-900 dark:text-gray-100">${esc(name)}</div>
            <div class="text-xs text-gray-600 dark:text-gray-300 break-all">${esc(uname)}</div>
          </div>
          <div class="text-sm">${adminStatusDot(status)}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    root.innerHTML = '';
    root.appendChild(header);
    root.appendChild(grid);
  }

  async function init(){
    const root = document.getElementById('admin-overview');
    if (!root) return; // do nothing unless container exists
    const data = await fetchAdminsOverview();
    renderAdminOverview(data);
  }

  window.initAdminOverview = init;
})();
