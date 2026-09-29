import { CONFIG } from './config.js';
export const $ = (selector, root = document) => root.querySelector(selector);
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function message(node, text = '', type = 'info') {
  node.textContent = text;
  node.className = `notice ${type}`;
  node.hidden = !text;
}
export function setupForm(form) {
  const category = form.elements.food_category;
  category.replaceChildren(...CONFIG.categories.map(value => {
    const option = el('option', value); option.value = value; return option;
  }));
  category.value = 'Undecided';
  form.elements.household_name.addEventListener('input', () => form.elements.household_name.setCustomValidity(''));
  form.elements.attendance.addEventListener('change', () => syncAttendance(form));
  for (const name of ['adults', 'children']) form.elements[name].addEventListener('input', () => form.elements.adults.setCustomValidity(''));
  syncAttendance(form);
}
export function syncAttendance(form) {
  const no = form.elements.attendance.value === 'No';
  for (const name of ['adults', 'children']) {
    const input = form.elements[name];
    if (no) input.value = '0';
    input.disabled = no;
  }
  form.elements.adults.setCustomValidity('');
}
export function formValues(form) {
  const get = name => form.elements[name].value.trim();
  const name = get('household_name');
  form.elements.household_name.setCustomValidity(name ? '' : 'Please enter a household name.');
  const attendance = get('attendance');
  const adults = attendance === 'No' ? 0 : Number(get('adults'));
  const children = attendance === 'No' ? 0 : Number(get('children'));
  form.elements.adults.setCustomValidity(attendance === 'Yes' && adults + children < 1 ? 'Please include at least one person.' : '');
  if (!form.reportValidity()) return null;
  return { household_name: name, attendance, adults, children,
    food_category: get('food_category'), bringing: get('bringing'), quantity: get('quantity'), dietary_requirements: get('dietary_requirements') };
}
export function fillForm(form, row) {
  for (const key of ['household_name', 'attendance', 'adults', 'children', 'food_category', 'bringing', 'quantity', 'dietary_requirements']) {
    form.elements[key].value = row[key] ?? '';
  }
  syncAttendance(form);
}
export const rpcValues = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [`p_${key}`, value]));
export function downloadText(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
