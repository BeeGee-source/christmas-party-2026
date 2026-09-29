import { CONFIG } from './config.js';
import { rpc } from './api.js';
import { $, el, message, setupForm, fillForm, formValues, rpcValues, syncAttendance, downloadText } from './ui.js';

const form = $('#rsvp-form');
const fields = $('#rsvp-fields');
const formStatus = $('#form-status');
const tokenKey = 'bg-christmas-2026-edit-token';
let editToken = null;
let busy = false;
let potluckRows = [];
let category = 'All';
setupForm(form);
$('#location').textContent = CONFIG.location;

function storeToken(token) {
  editToken = token;
  try { if (token) sessionStorage.setItem(tokenKey, token); else sessionStorage.removeItem(tokenKey); } catch { /* Saved link remains usable. */ }
}
function editUrl() {
  const url = new URL('./index.html', location.href);
  url.hash = new URLSearchParams({ edit: editToken }).toString();
  return url.href;
}
function setMode() {
  $('#edit-banner').hidden = !editToken;
  $('#submit-rsvp').textContent = editToken ? 'Save changes ↗' : 'Send our RSVP ↗';
}
async function loadEdit(token) {
  storeToken(token); setMode();
  fields.disabled = true;
  message(formStatus, 'Loading your RSVP…');
  try {
    const row = await rpc('get_rsvp_for_edit', { p_edit_token: token });
    if (editToken !== token) return;
    if (!row?.id) throw new Error('This editing link did not return an RSVP.');
    fillForm(form, row);
    fields.disabled = false;
    message(formStatus, 'Your RSVP is ready to edit.');
  } catch (error) {
    if (editToken !== token) return;
    message(formStatus, `${error.message} Check your saved link, or contact BG for help.`, 'error');
  }
}

function resetHousehold() {
  if (busy) return;
  if (!confirm('Start a separate household RSVP? Keep your existing private edit link if you need it later.')) return;
  storeToken(null);
  history.replaceState(null, '', location.pathname + '#rsvp');
  form.reset(); form.elements.food_category.value = 'Undecided'; syncAttendance(form);
  $('#saved-panel').hidden = true; form.hidden = false; fields.disabled = false;
  $('#link-saved').checked = false; $('#finish-rsvp').disabled = true; $('#copy-status').textContent = '';
  message(formStatus); setMode(); form.elements.household_name.focus();
}
$('#new-household').addEventListener('click', resetHousehold);

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const values = formValues(form);
  if (!values) return;
  busy = true; fields.disabled = true; $('#new-household').disabled = true;
  const wasEditing = Boolean(editToken);
  message(formStatus, wasEditing ? 'Saving your changes…' : 'Sending your RSVP…');
  try {
    const args = rpcValues(values);
    if (wasEditing) args.p_edit_token = editToken;
    const result = await rpc(wasEditing ? 'update_rsvp' : 'submit_rsvp', args);
    if (!result?.id || (!wasEditing && !/^[0-9a-f]{64}$/.test(result.edit_token || ''))) {
      throw new Error('We could not confirm the saved response. Please check with BG before submitting again.');
    }
    if (!wasEditing) {
      storeToken(result.edit_token);
      $('#link-saved').checked = false; $('#finish-rsvp').disabled = true;
    }
    $('#copy-status').textContent = '';
    $('#edit-link').value = editUrl();
    $('#saved-title').textContent = wasEditing ? 'Your changes are saved.' : 'Your RSVP is saved.';
    form.hidden = true; $('#saved-panel').hidden = false;
    message(formStatus); setMode(); $('#saved-panel').focus();
    void loadPotluck();
  } catch (error) {
    const uncertain = error.status === 0 || error.status >= 500;
    message(formStatus, error.message + (uncertain && !wasEditing ? ' Your RSVP may have saved. Check with BG before submitting again to avoid a duplicate.' : ''), 'error');
  } finally { busy = false; fields.disabled = false; $('#new-household').disabled = false; }
});
$('#edit-again').addEventListener('click', () => {
  $('#saved-panel').hidden = true; form.hidden = false; form.elements.household_name.focus();
});
$('#copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#edit-link').value);
    $('#copy-status').textContent = 'Copied! Now paste it into Notes or a message to yourself. Copying alone doesn’t keep it for next time.';
  } catch {
    $('#edit-link').focus(); $('#edit-link').select();
    $('#copy-status').textContent = 'Select and copy the link above, or save it as a file.';
  }
});
$('#download-link').addEventListener('click', () => {
  downloadText('Baguio-Peepz-2026-private-edit-link.txt', `${CONFIG.title} — 19 December 2026, 1 pm AEDT\n${CONFIG.location}\n\nOpen this link to change your guest numbers, food or attendance:\nPrivate RSVP edit link:\n${editUrl()}\n\nAnyone with this link can view and edit your household’s RSVP. Keep it private.\n`);
  $('#copy-status').textContent = 'Download requested. Check your Downloads folder for Baguio-Peepz-2026-private-edit-link.txt and keep that file.';
});
$('#link-saved').addEventListener('change', () => {
  $('#finish-rsvp').disabled = !$('#link-saved').checked;
});
$('#finish-rsvp').addEventListener('click', () => {
  if (!$('#link-saved').checked) return;
  $('#potluck-title').focus();
});

const symbols = { Main: '♨', Side: '❋', Dessert: '✧', Drinks: '◉', Snacks: '✦', Other: '✳', Undecided: '?', Nothing: '♡' };
function renderPotluck() {
  const filters = $('#category-filters');
  filters.replaceChildren();
  for (const value of ['All', ...CONFIG.categories]) {
    const count = value === 'All' ? potluckRows.length : potluckRows.filter(r => r.food_category === value).length;
    if (value !== 'All' && !count && value !== category) continue;
    const button = el('button', `${value} ${count}`, 'chip');
    button.type = 'button'; button.setAttribute('aria-pressed', String(value === category));
    button.addEventListener('click', () => { category = value; renderPotluck(); }); filters.append(button);
  }
  const grid = $('#potluck-grid'); grid.replaceChildren();
  const shown = potluckRows.filter(r => category === 'All' || r.food_category === category);
  if (!shown.length) {
    const empty = el('div', undefined, 'empty-state');
    empty.append(el('span', '✧', 'empty-icon'), el('h3', potluckRows.length ? 'Nothing in this category yet.' : 'The table is waiting for you.'), el('p', potluckRows.length ? 'Choose another category to see the menu.' : 'Confirmed RSVPs and their contributions will appear here.'));
    grid.append(empty); return;
  }
  for (const row of shown) {
    const card = el('article', undefined, 'potluck-card');
    const top = el('div', undefined, 'card-top');
    const icon = el('span', symbols[row.food_category] || '✧', 'food-icon'); icon.setAttribute('aria-hidden', 'true');
    top.append(el('span', row.food_category, 'eyebrow'), icon);
    card.append(top, el('h3', row.bringing || (row.food_category === 'Nothing' ? 'Joining the celebration' : 'Still deciding')), el('p', row.quantity || 'Quantity to be confirmed', 'small'), el('div', row.household_name, 'card-household'));
    grid.append(card);
  }
}
async function loadPotluck() {
  const refresh = $('#refresh-potluck');
  refresh.disabled = true; message($('#potluck-status'), 'Loading the latest contributions…');
  try {
    const rows = await rpc('get_potluck_list');
    if (!Array.isArray(rows)) throw new Error('The potluck list could not be read.');
    potluckRows = rows; renderPotluck(); message($('#potluck-status'));
  } catch (error) {
    message($('#potluck-status'), `We couldn’t refresh the potluck list. ${error.message}${potluckRows.length ? ' Previously loaded contributions are still shown.' : ''}`, 'error');
  } finally { refresh.disabled = false; }
}
$('#refresh-potluck').addEventListener('click', loadPotluck);

window.addEventListener('hashchange', () => {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('edit') && params.get('edit') !== editToken && !busy) {
    $('#saved-panel').hidden = true; form.hidden = false;
    void loadEdit(params.get('edit'));
    $('#rsvp').scrollIntoView();
  }
});

const hashParams = new URLSearchParams(location.hash.slice(1));
let initialToken = hashParams.has('edit') ? hashParams.get('edit') : null;
if (!hashParams.has('edit')) { try { initialToken = sessionStorage.getItem(tokenKey); } catch {} }
if (initialToken !== null) {
  void loadEdit(initialToken);
  $('#rsvp').scrollIntoView();
} else fields.disabled = false;
void loadPotluck();
