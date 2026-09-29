import { CONFIG } from './config.js';
import { hasSession, signIn, signOut, currentUser, listRsvps, updateHostRsvp, deleteHostRsvp } from './api.js';
import { $, el, message, setupForm, fillForm, formValues, downloadText } from './ui.js';

const loginForm = $('#login-form');
const editForm = $('#host-edit-form');
const dialog = $('#edit-dialog');
let rows = [];
let editingId = null;
let loaded = false;
let editing = false;
let mutation = false;
let refreshing = false;
setupForm(editForm);

function showLogin() {
  $('#dashboard').hidden = true; $('#login-panel').hidden = false; $('#signout').hidden = true;
  rows = []; loaded = false; editingId = null;
  $('#guest-rows').replaceChildren(); $('#stats').replaceChildren(); $('#food-totals').replaceChildren();
  $('#signed-in-as').textContent = ''; $('#export-csv').disabled = true;
  editForm.reset(); dialog.close();
}
async function openDashboard() {
  const user = await currentUser();
  $('#signed-in-as').textContent = `Signed in as ${user.email || 'host'}`;
  $('#login-panel').hidden = true; $('#dashboard').hidden = false; $('#signout').hidden = false;
  message($('#login-status')); await refresh();
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-fields').disabled = true; message($('#login-status'), 'Signing in…');
  try {
    await signIn(loginForm.elements.email.value.trim(), loginForm.elements.password.value);
    loginForm.elements.password.value = '';
    await openDashboard();
  } catch (error) { message($('#login-status'), error.message, 'error'); }
  finally { $('#login-fields').disabled = false; }
});
$('#signout').addEventListener('click', async () => {
  if (mutation) return;
  showLogin();
  try { await signOut(); message($('#login-status'), 'You’ve signed out.'); }
  catch { message($('#login-status'), 'Signed out of this tab. The server could not be reached to revoke the session.', 'error'); }
});

async function refresh() {
  if (refreshing || mutation) return;
  refreshing = true; $('#refresh-admin').disabled = true;
  for (const button of document.querySelectorAll('#guest-rows button')) button.disabled = true;
  message($('#admin-status'), 'Loading RSVPs…');
  try {
    const nextRows = await listRsvps();
    // Ignore a request that completed after sign-out.
    if ($('#dashboard').hidden) return;
    rows = nextRows; loaded = true; render();
    const time = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' }).format(new Date());
    message($('#admin-status'), `Up to date at ${time} Melbourne time.`);
  } catch (error) {
    if ($('#dashboard').hidden) return;
    if (error.status === 401) { showLogin(); message($('#login-status'), 'Your session expired. Please sign in again.', 'error'); }
    else message($('#admin-status'), `${error.message}${loaded ? ' Previously loaded data is still shown.' : ''}`, 'error');
  } finally { refreshing = false; lockMutation(mutation); }
}
$('#refresh-admin').addEventListener('click', refresh);
$('#guest-search').addEventListener('input', renderRows);
$('#attendance-filter').addEventListener('change', renderRows);

function render() {
  const confirmed = rows.filter(r => r.attendance === 'Yes');
  const adults = confirmed.reduce((sum, r) => sum + r.adults, 0);
  const children = confirmed.reduce((sum, r) => sum + r.children, 0);
  const metrics = [[adults + children, 'Confirmed people', `${adults} adults · ${children} children`], [confirmed.length, 'Attending households', 'Answered Yes'], [rows.filter(r => r.attendance === 'Maybe').length, 'Maybe households', 'Waiting to confirm'], [rows.filter(r => r.attendance === 'No').length, 'Declined households', 'Answered No']];
  const stats = $('#stats'); stats.replaceChildren();
  for (const [value, label, sub] of metrics) {
    const card = el('article', undefined, 'stat-card'); card.append(el('span', label, 'detail-label'), el('strong', value), el('span', sub, 'small')); stats.append(card);
  }
  $('#food-totals').replaceChildren();
  for (const category of CONFIG.categories) {
    const item = el('div', undefined, 'food-total');
    item.append(el('strong', confirmed.filter(r => r.food_category === category).length), el('span', category)); $('#food-totals').append(item);
  }
  $('#export-csv').disabled = !loaded || !rows.length; renderRows();
}
function renderRows() {
  const search = $('#guest-search').value.trim().toLowerCase();
  const status = $('#attendance-filter').value;
  const filtered = rows.filter(row => (status === 'All' || row.attendance === status) && [row.household_name, row.bringing, row.dietary_requirements].some(value => (value || '').toLowerCase().includes(search)));
  const body = $('#guest-rows'); body.replaceChildren();
  $('#record-count').textContent = `${filtered.length} of ${rows.length} household responses`;
  $('#admin-empty').hidden = filtered.length > 0 || !loaded;
  if (loaded) {
    $('#admin-empty h3').textContent = rows.length ? 'No matching households.' : 'No responses yet.';
    $('#admin-empty p').textContent = rows.length ? 'Try another search or attendance filter.' : 'Once guests submit their RSVPs, you’ll see them here.';
  }
  for (const row of filtered) {
    const tr = el('tr');
    const name = el('td'); name.append(el('strong', row.household_name));
    const date = new Date(row.created_at);
    if (!Number.isNaN(date.valueOf())) name.append(el('span', new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'Australia/Melbourne' }).format(date), 'small table-sub'));
    const statusCell = el('td'); statusCell.append(el('span', row.attendance, `badge ${row.attendance.toLowerCase()}`));
    const food = el('td'); food.append(el('span', row.bringing || 'Not specified'), el('span', [row.food_category, row.quantity].filter(Boolean).join(' · '), 'small table-sub'));
    const actions = el('td');
    const edit = el('button', 'Edit', 'text-button'); edit.type = 'button'; edit.setAttribute('aria-label', `Edit ${row.household_name}`);
    edit.disabled = mutation || refreshing;
    edit.addEventListener('click', () => {
      editingId = row.id; fillForm(editForm, row); message($('#edit-status')); $('#edit-title').textContent = `Edit ${row.household_name}`; dialog.showModal();
    });
    const remove = el('button', 'Remove', 'text-button danger'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${row.household_name}`);
    remove.disabled = mutation || refreshing;
    remove.addEventListener('click', () => removeRsvp(row));
    actions.append(edit, remove);
    tr.append(name, statusCell, el('td', row.adults), el('td', row.children), food, el('td', row.dietary_requirements || '—'), actions); body.append(tr);
  }
}
function lockMutation(value) {
  mutation = value;
  $('#signout').disabled = value; $('#refresh-admin').disabled = value;
  for (const button of document.querySelectorAll('#guest-rows button')) button.disabled = value;
}
async function removeRsvp(row) {
  if (mutation || !confirm(`Remove the RSVP for ${row.household_name}? This cannot be undone and their edit link will stop working.`)) return;
  lockMutation(true); message($('#admin-status'), 'Removing RSVP…');
  try {
    await deleteHostRsvp(row.id); rows = rows.filter(r => r.id !== row.id); render();
    message($('#admin-status'), 'RSVP removed.');
  } catch (error) { message($('#admin-status'), error.message + ' Refresh before trying again.', 'error'); }
  finally { lockMutation(false); }
}
$('#close-dialog').addEventListener('click', () => { if (!editing) dialog.close(); });
dialog.addEventListener('cancel', event => { if (editing) event.preventDefault(); });
editForm.addEventListener('submit', async event => {
  event.preventDefault(); if (editing || !editingId || mutation) return;
  const values = formValues(editForm); if (!values) return;
  editing = true; lockMutation(true); $('#host-edit-fields').disabled = true; $('#close-dialog').disabled = true;
  message($('#edit-status'), 'Saving changes…');
  try {
    const updated = await updateHostRsvp(editingId, values);
    rows = rows.map(row => row.id === editingId ? updated : row); render(); dialog.close(); editForm.reset(); editingId = null;
    message($('#admin-status'), 'Household changes saved.');
  } catch (error) { message($('#edit-status'), error.message, 'error'); }
  finally { editing = false; lockMutation(false); $('#host-edit-fields').disabled = false; $('#close-dialog').disabled = false; }
});
$('#export-csv').addEventListener('click', () => {
  const columns = ['household_name', 'attendance', 'adults', 'children', 'food_category', 'bringing', 'quantity', 'dietary_requirements', 'created_at'];
  const cell = value => {
    let text = String(value ?? '');
    // Prevent spreadsheet software from interpreting guest input as a formula.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const csv = '\ufeff' + [columns, ...rows.map(row => columns.map(column => row[column]))].map(row => row.map(cell).join(',')).join('\r\n');
  downloadText('Christmas-2026-RSVPs.csv', csv, 'text/csv;charset=utf-8');
});
if (hasSession()) {
  $('#login-fields').disabled = true; message($('#login-status'), 'Restoring your session…');
  openDashboard().catch(error => { showLogin(); message($('#login-status'), error.message, 'error'); }).finally(() => { $('#login-fields').disabled = false; });
}
