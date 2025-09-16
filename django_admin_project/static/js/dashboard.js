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

// Robust CSRF token getter (mirrors admin_management.js behavior)
function csrf(){
  try {
    if (typeof window.getCookie === 'function'){
      const v = window.getCookie('csrftoken');
      if (v) return v;
    }
    const name = 'csrftoken=';
    const parts = (document.cookie || '').split(';');
    for (let i=0;i<parts.length;i++){
      const c = parts[i].trim();
      if (c.startsWith(name)) return decodeURIComponent(c.substring(name.length));
    }
    try {
      const el = document.querySelector('input[name="csrfmiddlewaretoken"]');
      if (el && el.value) return String(el.value);
    } catch(_){ }
    return '';
  } catch(_){ return ''; }
}


async function fetchTableData(tableId, page=1, q='') {
  const url = `/dashboard/api/table/${tableId}/?page=${page}&per_page=10&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.status === 403) return { success: false, error: 'Forbidden' };
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
  try { rowData.append('csrfmiddlewaretoken', csrf()); } catch(_){ }
  const doFetch = () => fetch(`/dashboard/api/table/${tableId}/row/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
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
  try { rowData.append('csrfmiddlewaretoken', csrf()); } catch(_){ }
  const doFetch = () => fetch(`/dashboard/api/table/${tableId}/row/${rowId}/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
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
  try { fd.append('csrfmiddlewaretoken', csrf()); } catch(_){ }
  const doFetch = () => fetch(`/dashboard/api/table/${tableId}/row/${rowId}/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
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
    // Table 1 (Admins) is not available via generic tables API.
    // To keep UX smooth and avoid surprise navigation, default to Table 2 on Tables page.
    if (tid === 1) {
      const fallbackTid = 2;
      if (picker) picker.value = String(fallbackTid);
      try { if (typeof showNotification === 'function') showNotification('Table 1 is managed in Admin Management. Showing Table 2 here.', 'info'); } catch(_){ }
      if (typeof refreshTable === 'function') refreshTable(fallbackTid);
      return;
    }
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
  // Respect active filter chip if present (empty => All)
  let tableFilter = '';
  try {
    const active = document.querySelector('[data-log-filter].is-active');
    if (active) tableFilter = active.getAttribute('data-log-filter') || '';
  } catch(_) { tableFilter = ''; }
  const qp = new URLSearchParams();
  qp.set('per_page', '10');
  if (tableFilter) qp.set('table_name', tableFilter);
  const res = await fetch(`/dashboard/api/logs/?${qp.toString()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
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
if (!window.__handleLiveSearch) window.__handleLiveSearch = debounce(function(inputEl){  // added
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
    window.__handleLiveSearch(el);  // added
  }  // added
});  // added

// Ensure Add/Refresh/Search buttons work via delegated handler even if inline onclick is removed for CSP  // added
document.addEventListener('click', function(e){  // added
  try {  // added
    const btn = e.target && e.target.closest('button');  // added
    if (!btn) return;  // added
    // Log filter chips
    if (btn.hasAttribute('data-log-filter')){
      e.preventDefault();
      // Toggle active state within group
      try {
        const group = btn.parentElement;
        if (group){
          group.querySelectorAll('[data-log-filter]').forEach(n => { n.classList.remove('is-active'); n.setAttribute('aria-pressed','false'); });
        }
      } catch(_){ }
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed','true');
      if (typeof window.refreshLogs === 'function') window.refreshLogs();
      return;
    }
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
  // Recent Client Activity side card
  async function fetchClientActivity(){
    try {
      const url = new URL('/api/v1/logs/', window.location.origin);
      url.searchParams.set('table_name', 'Client');
      url.searchParams.set('per_page', '8');
      const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
      const data = await res.json();
      return (data && data.results) ? data.results : [];
    } catch(_) { return []; }
  }

  function renderClientActivity(list){
    const host = document.getElementById('client-activity-card');
    if (!host) return;
    host.innerHTML = '';
    if (!list || list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'text-sm text-gray-500';
      empty.textContent = 'No recent client activity.';
      host.appendChild(empty);
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'space-y-2';
    list.forEach(x => {
      const li = document.createElement('li');
      li.className = 'flex items-start gap-2';
      const badge = document.createElement('span');
      badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ' + (x.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700' : x.action === 'LOGIN' ? 'bg-blue-50 text-blue-700' : x.action === 'LOGOUT' ? 'bg-gray-100 text-gray-700' : 'bg-indigo-50 text-indigo-700');
      badge.textContent = x.action || '';
      const main = document.createElement('div');
      main.className = 'text-sm text-gray-800 dark:text-gray-200';
      main.innerHTML = `<div><strong>${esc(x.table_name || 'Client')}</strong> · ${esc(x.row_id || '')}</div><div class="text-xs text-gray-500">${esc(x.timestamp || '')}</div>`;
      li.appendChild(badge);
      li.appendChild(main);
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  window.hydrateClientActivityCard = function(){
    fetchClientActivity().then(renderClientActivity).catch(()=>{});
  };
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
})();

// ---------------- Client Logs (full-width table) + Optional Admin Overview ----------------
(function(){
  // Populate Recent Client Activity table with only Client logs
  window.refreshClientLogs = async function(){
    try {
      const tbl = document.getElementById('client-logs-table'); if (!tbl) return;
      const tbody = tbl.querySelector('tbody'); if (!tbody) return;
      // Inject notification styles if not already present, to reuse glowing animation
      (function ensureNotifStylesIfMissing(){
        try {
          if (document.getElementById('notifGlowStyles')) return;
          const style = document.createElement('style');
          style.id = 'notifGlowStyles';
          style.textContent = `
@keyframes notifPulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.28)}70%{box-shadow:0 0 0 10px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}
@keyframes notifGlowOut{0%{background-color:rgba(59,130,246,0.06)}100%{background-color:transparent}}
.notif-new{background-color:rgba(59,130,246,0.06); animation:notifPulse 1800ms ease-out infinite}
.dark .notif-new{background-color:rgba(59,130,246,0.12)}
.notif-fade{animation:notifGlowOut 600ms ease-out 1}`;
          document.head.appendChild(style);
        } catch(_){ }
      })();

      // Human-friendly time ago similar to notifications.js
      function timeAgo(iso){
        try {
          const d = new Date(iso);
          const now = new Date();
          const sec = Math.max(0, Math.floor((now - d) / 1000));
          if (sec < 10) return 'just now';
          if (sec < 60) return `${sec}s ago`;
          const min = Math.floor(sec / 60);
          if (min < 60) return `${min} min ago`;
          const hr = Math.floor(min / 60);
          if (hr < 24) return `${hr} h ago`;
          const day = Math.floor(hr / 24);
          if (day < 7) return `${day} d ago`;
          return d.toLocaleString();
        } catch { return iso; }
      }

      const url = new URL('/api/v1/logs/', window.location.origin);
      url.searchParams.set('table_name', 'Client');
      url.searchParams.set('per_page', '8');
      const res = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
      const data = await res.json().catch(()=>({}));
      const items = (data && data.results) ? data.results : [];
      tbody.innerHTML = '';
      if (!items.length){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td class="py-3 text-gray-500 dark:text-gray-300" colspan="6">No recent client activity.</td>';
        tbody.appendChild(tr);
        return;
      }
      const nowMs = Date.now();
      items.forEach(x => {
        const tr = document.createElement('tr');
        // Highlight if within last 60s, mirroring notifications glow
        let withinOneMinute = false;
        try { withinOneMinute = Math.abs(nowMs - new Date(x.timestamp).getTime()) <= 60 * 1000; } catch(_){ }
        tr.className = 'border-b ' + (withinOneMinute ? 'notif-new' : '');
        const rd = (x.row_details || {});
        const fullName = rd.full_name || rd.name || '';
        const email = rd.email || '';
        const location = rd.location || rd.city || '';
        const phone = rd.phone || '';
        // Small action icons for scanability
        const action = (x.action || '').toUpperCase();
        let icon = '';
        if (action === 'CREATE') {
          icon = '<svg class="w-4 h-4 text-emerald-600 inline-block align-[-2px] mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293A1 1 0 106.293 10.707l2 2a1 1 0 001.414 0l3.999-4z"/></svg>';
        } else if (action === 'LOGIN') {
          icon = '<svg class="w-4 h-4 text-blue-600 inline-block align-[-2px] mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4a2 2 0 012-2h6a2 2 0 012 2v3h-2V4H5v12h6v-3h2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V4z"/><path d="M12 11h-5v-2h5V6l5 4-5 4v-3z"/></svg>';
        } else if (action === 'LOGOUT') {
          icon = '<svg class="w-4 h-4 text-gray-600 inline-block align-[-2px] mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 4a2 2 0 012-2h3a2 2 0 012 2v3h-2V4H9v12h3v-3h2v3a2 2 0 01-2 2H9a2 2 0 01-2-2V4z"/><path d="M13 11H5V9h8V6l5 4-5 4v-3z"/></svg>';
        } else if (action === 'PASSWORD_RESET') {
          icon = '<svg class="w-4 h-4 text-indigo-600 inline-block align-[-2px] mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a4 4 0 00-4 4v2H5a3 3 0 00-3 3v4a3 3 0 003 3h10a3 3 0 003-3v-4a3 3 0 00-3-3h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z"/></svg>';
        } else if (action === 'FORGOT_PASSWORD') {
          icon = '<svg class="w-4 h-4 text-amber-600 inline-block align-[-2px] mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9 14h2v2H9v-2zm1-9a3 3 0 00-3 3h2a1 1 0 112 0c0 .667-.333 1.111-1.2 1.8C9.333 10.4 9 11 9 12h2c0-.5.167-.8.8-1.3.866-.7 2.2-1.5 2.2-3.7a3 3 0 00-3-3z"/></svg>';
        } else if (action === 'ARTIST_APPLY') {
          icon = '<svg class="w-4 h-4 text-violet-600 inline-block align-[-2px] mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 3a2 2 0 00-2 2v10l4-2 4 2 4-2 4 2V5a2 2 0 00-2-2H4z"/></svg>';
        }

        tr.innerHTML = `
          <td class="py-2 pr-2">${esc(timeAgo(x.timestamp || ''))}</td>
          <td class="py-2 pr-2">${esc(fullName)}</td>
          <td class="py-2 pr-2">${esc(email)}</td>
          <td class="py-2 pr-2">${esc(location)}</td>
          <td class="py-2 pr-2">${esc(phone)}</td>
          <td class="py-2 pr-2">${icon}${esc(action)}</td>`;
        tbody.appendChild(tr);
      });
    } catch(_){ /* no-op */ }
  };
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
})();

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
      // Kick off recent client activity card hydration when present
      try { if (document.getElementById('client-activity-card')) hydrateClientActivityCard(); } catch(_){ }
      // Kick off Recent Client Activity (full-width table) hydration when present
      try { if (document.getElementById('client-logs-table')) refreshClientLogs(); } catch(_){ }
      // Piggyback on notifications bump to keep client logs fresh without editing notifications.js
      try {
        if (!window.__clientLogsWrapped && typeof window.bumpNotificationsNow === 'function'){
          const __origBump = window.bumpNotificationsNow;
          window.bumpNotificationsNow = function(){
            try { __origBump && __origBump(); } catch(_){ }
            try { if (document.getElementById('client-logs-table')) refreshClientLogs(); } catch(_){ }
          };
          window.__clientLogsWrapped = true;
        }
      } catch(_){ }
    });
  } else {
    if (document.getElementById('tablePicker')) initTablesFullPage();
    try { if (typeof window.initAdminOverview === 'function') window.initAdminOverview(); } catch(_){ }
    try { if (document.getElementById('client-logs-table')) refreshClientLogs(); } catch(_){ }
    try {
      if (!window.__clientLogsWrapped && typeof window.bumpNotificationsNow === 'function'){
        const __origBump = window.bumpNotificationsNow;
        window.bumpNotificationsNow = function(){
          try { __origBump && __origBump(); } catch(_){ }
          try { if (document.getElementById('client-logs-table')) refreshClientLogs(); } catch(_){ }
        };
        window.__clientLogsWrapped = true;
      }
    } catch(_){ }
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
