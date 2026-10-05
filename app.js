// Wardrobe: closet, outfit of the day and wish list.
// Everything stays on this phone: details in localStorage, photos in IndexedDB.

const KEY = 'wardrobe.v1';
const BLANK = { items: [], outfit: [], log: [], wishes: [] };
let S = { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

// type -> [label, category]. Wears are counted by default only for clothing.
const TYPES = {
  tee: ['Tee', 'Tops'], sweater: ['Long sleeve', 'Tops'], tank: ['Tank', 'Tops'],
  pants: ['Trousers', 'Bottoms'], shorts: ['Shorts', 'Bottoms'], skirt: ['Skirt', 'Bottoms'],
  dress: ['Dress', 'Dresses'], coat: ['Jacket', 'Outerwear'],
  shoe: ['Shoes', 'Shoes'], boot: ['Boots', 'Shoes'], heel: ['Heels', 'Shoes'],
  bag: ['Bag', 'Bags'], shades: ['Sunglasses', 'Sunglasses'], hat: ['Hat', 'Accessories'], gem: ['Jewellery', 'Accessories'],
};
const CATS = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Sunglasses', 'Accessories'];
const COUNTED = ['Tops', 'Bottoms', 'Dresses', 'Outerwear'];
const PALETTE = ['#2a2227', '#5b5560', '#a9a5a8', '#f4f1ea', '#e9dcc3', '#c9b79a', '#9a7b5b', '#5e4034', '#7a2738', '#b8475a',
  '#e9a3b5', '#d9783c', '#e8c66a', '#6d7f5c', '#3f7a56', '#a9c3e0', '#4a6fa5', '#26324a', '#7b5ea7', '#c3b1e1'];
const FAMILIES = [['Black', '#2a2227'], ['Grey', '#a9a5a8'], ['White', '#f4f1ea'], ['Neutral', '#c9b79a'], ['Brown', '#6b4a3a'], ['Red', '#b8475a'],
  ['Pink', '#e9a3b5'], ['Orange', '#d9783c'], ['Yellow', '#e8c66a'], ['Green', '#6d7f5c'], ['Blue', '#4a6fa5'], ['Purple', '#7b5ea7']];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const niceDate = d => new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const hexOk = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#a9a5a8';
const cat = it => (TYPES[it.type] || TYPES.tee)[1];
const label = it => it.name || (TYPES[it.type] || TYPES.tee)[0];
const item = id => S.items.find(i => i.id === id);
const wornThisYear = it => it.wears.filter(d => d.startsWith(today().slice(0, 4))).length;

let tab = 'closet', view = 'pieces', filter = 'All';
let D = null; // piece being added or edited
let W = null; // wish being added or edited

/* ---------- photos (IndexedDB) ---------- */
const urls = new Map(); // item id -> object URL
const db = new Promise((res, rej) => {
  const r = indexedDB.open('wardrobe-media', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('photos');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const store = (mode, fn) => db.then(d => new Promise((res, rej) => {
  const t = d.transaction('photos', mode), q = fn(t.objectStore('photos'));
  t.oncomplete = () => res(q && q.result);
  t.onerror = t.onabort = () => rej(t.error);
}));
function showPhoto(id, blob) {
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
  blob ? urls.set(id, URL.createObjectURL(blob)) : urls.delete(id);
}
const putPhoto = (id, blob) => store('readwrite', s => s.put(blob, id)).then(() => showPhoto(id, blob));
const delPhoto = id => store('readwrite', s => s.delete(id)).then(() => showPhoto(id));
async function loadPhotos() {
  const [keys, blobs] = await Promise.all([store('readonly', s => s.getAllKeys()), store('readonly', s => s.getAll())]);
  keys.forEach((k, i) => showPhoto(k, blobs[i]));
}

/* ---------- colour ---------- */
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const h = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)), l];
}
function family(hex) {
  const [h, s, l] = hsl(hex);
  if (l < .2 || (l < .3 && s < .25)) return 'Black';
  if (s < .12) return l > .85 ? 'White' : 'Grey';
  if (l > .88) return 'White';
  if (h >= 15 && h < 55 && s < .55) return l > .55 ? 'Neutral' : 'Brown';
  if (h < 15 || h >= 345) return l > .7 ? 'Pink' : 'Red';
  if (h < 40) return l < .4 ? 'Brown' : 'Orange';
  if (h < 70) return 'Yellow';
  if (h < 170) return 'Green';
  if (h < 260) return 'Blue';
  if (h < 295) return 'Purple';
  return 'Pink';
}

/* ---------- drawing pieces ---------- */
const shape = (type, color) => `<svg class="g" style="color:${color}" aria-hidden="true"><use href="#${TYPES[type] ? type : 'tee'}"/></svg>`;
function art(it) {
  const u = it.photo && urls.get(it.id);
  return u ? `<img class="${it.photo === 'raw' ? 'raw' : 'cut'}" src="${u}" alt="">` : shape(it.type, hexOk(it.color));
}
const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5l4 4 8-9"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
};
function tile(it) {
  const on = S.outfit.includes(it.id);
  return `<figure class="piece${it.place ? ' stored' : ''}">
    <button class="t" data-a="edit" data-id="${it.id}" aria-label="${esc(label(it))}">${art(it)}${it.place ? `<span class="tag">${esc(it.place)}</span>` : ''}</button>
    <button class="pick${on ? ' on' : ''}" data-a="pick" data-id="${it.id}" aria-pressed="${on}" aria-label="Today's outfit: ${esc(label(it))}"><span>${on ? ICON.check : ICON.plus}</span></button>
    <figcaption><b>${esc(label(it))}</b>${it.track && wornThisYear(it) ? `<span>${wornThisYear(it)}×</span>` : ''}</figcaption>
  </figure>`;
}
const byCat = (a, b) => CATS.indexOf(cat(a)) - CATS.indexOf(cat(b)) || (b.added || 0) - (a.added || 0);

/* ---------- screens ---------- */
function render() {
  $('#title').textContent = { closet: 'Closet', today: 'Today', wish: 'Wish list' }[tab];
  $('#add').textContent = tab === 'wish' ? 'Add wish' : 'Add piece';
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#badge').hidden = !S.outfit.length;
  $('#badge').textContent = S.outfit.length;
  $('#main').innerHTML = { closet: closet, today: todayScreen, wish: wishScreen }[tab]();
}

function closet() {
  if (!S.items.length) return `<div class="empty"><p>Your closet is empty.</p>
    <p class="muted">Add a piece with a shape and a colour now, and photograph it whenever you like.</p>
    <button class="btn primary" data-a="add">Add your first piece</button>
    <button class="quiet" data-a="backup">Restore a backup</button></div>`;
  const seg = `<div class="seg">${[['pieces', 'Pieces'], ['colour', 'Colour'], ['storage', 'Storage']]
    .map(([v, l]) => `<button data-a="view" data-view="${v}" class="${view === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return seg + { pieces, colour, storage }[view]() + `<button class="quiet foot" data-a="backup">Backup &amp; storage</button>`;
}

function pieces() {
  const cats = CATS.filter(c => S.items.some(i => cat(i) === c));
  if (!cats.includes(filter)) filter = 'All';
  const list = S.items.filter(i => filter === 'All' || cat(i) === filter).sort(byCat);
  return `<div class="chips">${['All', ...cats].map(c => `<button data-a="filter" data-cat="${c}" class="${filter === c ? 'on' : ''}">${c}</button>`).join('')}</div>
    <div class="grid">${list.map(tile).join('')}</div>`;
}

function colour() {
  const groups = FAMILIES.map(([name, rep]) => ({ name, rep, list: S.items.filter(i => family(hexOk(i.color)) === name) })).filter(g => g.list.length);
  const chip = it => {
    const c = hexOk(it.color), light = hsl(c)[2] > .62;
    return `<button class="chip" style="background:${c}" data-a="edit" data-id="${it.id}" aria-label="${esc(label(it))}">${shape(it.type, light ? 'rgba(58,34,48,.55)' : 'rgba(255,255,255,.78)')}</button>`;
  };
  return `<div class="bar">${groups.map(g => `<span style="background:${g.rep};flex:${g.list.length}"></span>`).join('')}</div>
    <div class="legend">${groups.map(g => `<span><i style="background:${g.rep}"></i>${g.name} ${g.list.length}</span>`).join('')}</div>
    <div class="swgrid">${groups.flatMap(g => g.list.sort((a, b) => hsl(hexOk(a.color))[2] - hsl(hexOk(b.color))[2]).map(chip)).join('')}</div>`;
}

function storage() {
  const places = [...new Set(S.items.filter(i => i.place).map(i => i.place))].sort();
  if (!places.length) return `<div class="empty"><p>Nothing is in storage.</p><p class="muted">Open a piece and set where it's stored. It will show up here, grouped by place.</p></div>`;
  return places.map(p => {
    const list = S.items.filter(i => i.place === p).sort(byCat);
    return `<h2 class="sub">${esc(p)} <span>${list.length} ${list.length === 1 ? 'piece' : 'pieces'}</span></h2><div class="grid">${list.map(tile).join('')}</div>`;
  }).join('');
}

function todayScreen() {
  const picked = S.outfit.map(item).filter(Boolean);
  const outfit = picked.length
    ? `<div class="grid two">${picked.map(it => `<figure class="piece">
        <button class="t" data-a="edit" data-id="${it.id}" aria-label="${esc(label(it))}">${art(it)}</button>
        <button class="pick" data-a="unpick" data-id="${it.id}" aria-label="Remove ${esc(label(it))}"><span>${ICON.x}</span></button>
        <figcaption><b>${esc(label(it))}</b></figcaption></figure>`).join('')}</div>
      <button class="btn primary wide" data-a="wore">Wore it today</button>
      <button class="quiet" data-a="clear">Clear</button>`
    : `<div class="empty"><p>No outfit yet.</p><p class="muted">Tap the plus on any piece in your closet and it lands here.</p>
        <button class="btn primary" data-a="tab" data-tab="closet">Open closet</button></div>`;
  const recent = S.log.slice(0, 8).map((o, i) => {
    const list = o.ids.map(item).filter(Boolean);
    return list.length ? `<button class="past" data-a="again" data-i="${i}"><span class="when">${niceDate(o.date)}</span>
      <span class="minis">${list.map(it => `<span class="t">${art(it)}</span>`).join('')}</span></button>` : '';
  }).join('');
  return outfit + (recent ? `<h2 class="sub">Recent outfits <span>tap to wear again</span></h2>${recent}` : '');
}

function wishScreen() {
  if (!S.wishes.length) return `<div class="empty"><p>Nothing on your wish list.</p><p class="muted">Save pieces you're eyeing with a link to the shop.</p>
    <button class="btn primary" data-a="add">Add a wish</button></div>`;
  return S.wishes.map(w => {
    let host = '';
    try { host = new URL(w.url).hostname.replace(/^www\./, ''); } catch {}
    const meta = [host, w.price].filter(Boolean).map(esc).join(' · ');
    const body = `<b>${esc(w.name || host || 'Untitled')}</b>${meta ? `<span>${meta}</span>` : ''}${w.note ? `<span class="note">${esc(w.note)}</span>` : ''}`;
    return `<div class="wish">${host ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${body}</a>` : `<button data-a="wish" data-id="${w.id}">${body}</button>`}
      <button class="more" data-a="wish" data-id="${w.id}" aria-label="Edit ${esc(w.name)}">Edit</button></div>`;
  }).join('');
}

/* ---------- sheets ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = html;
  $('#sheet').hidden = $('#scrim').hidden = false;
  $('#sheet').scrollTop = 0;
  document.body.classList.add('locked');
}
function closeSheet() {
  // An unsaved new piece may already have a photo stored for it.
  if (D && D.isNew && !item(D.id)) delPhoto(D.id);
  D = W = null;
  $('#sheet').hidden = $('#scrim').hidden = true;
  document.body.classList.remove('locked');
}
const head = t => `<div class="sheet-head"><h2>${t}</h2><button type="button" class="x" data-a="close" aria-label="Close">${ICON.x}</button></div>`;

function openItem(it, preset = {}) {
  D = it ? { ...it, wears: [...it.wears], colorTouched: true, trackTouched: true }
    : { id: uid(), name: '', type: 'tee', color: '#f4f1ea', place: '', track: true, photo: '', wears: [], isNew: true, ...preset };
  D.stored = !!D.place;
  const places = [...new Set(S.items.map(i => i.place).filter(Boolean))];
  openSheet(`<form id="itemForm">${head(D.isNew ? 'New piece' : 'Edit piece')}
    <div class="photo-row">
      <div class="t" id="pv"></div>
      <div>
        <label class="btn soft small"><input type="file" accept="image/*" id="file" class="vh"><span id="photoBtn"></span></label>
        <p class="hint" id="photoHint"></p>
        <button type="button" class="quiet" data-a="rmphoto" id="rmPhoto">Remove photo</button>
      </div>
    </div>
    <label class="field"><span>Name</span><input id="fName" value="${esc(D.name)}" placeholder="White tee" autocomplete="off" enterkeyhint="done"></label>
    <div class="field"><span>Type</span><div class="types">${Object.entries(TYPES).map(([k, [l]]) =>
      `<button type="button" data-a="type" data-type="${k}">${shape(k, 'currentColor')}<small>${l}</small></button>`).join('')}</div></div>
    <div class="field"><span>Colour</span><div class="swatches">${PALETTE.map(c =>
      `<button type="button" data-a="color" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}
      <label class="custom" aria-label="Another colour"><input type="color" id="fColor" value="${hexOk(D.color)}"></label></div></div>
    <div class="field"><span>Where</span><div class="seg"><button type="button" data-a="where" data-stored="">In closet</button><button type="button" data-a="where" data-stored="1">In storage</button></div>
      <input id="fPlace" value="${esc(D.place)}" list="places" placeholder="Bin 2, under the bed…" autocomplete="off" enterkeyhint="done">
      <datalist id="places">${places.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    <label class="check"><input type="checkbox" id="fTrack"> Count wears</label>
    <div class="wears" id="wears"></div>
    <button class="btn primary wide">Save</button>
    ${D.isNew ? '<button type="button" class="btn soft wide" data-a="saveMore">Save and add another</button>'
      : '<button type="button" class="quiet danger" data-a="del">Delete piece</button>'}
  </form>`);
  paint();
}

// Refresh the parts of the piece sheet that depend on the draft, without touching what's being typed.
function paint() {
  if (!D) return;
  $('#pv').innerHTML = art(D);
  $('#photoBtn').textContent = D.photo ? 'Replace photo' : 'Add photo';
  $('#photoHint').textContent = D.status || (D.photo === 'raw' ? 'Saved without a cutout. Add the photo again to retry.'
    : D.photo ? '' : 'Optional. The background is removed for you.');
  $('#rmPhoto').hidden = !D.photo || !!D.status;
  $('#sheet').querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === D.type));
  $('#sheet').querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === D.color));
  $('#sheet .custom').classList.toggle('on', !PALETTE.includes(D.color));
  $('#sheet .custom').style.background = PALETTE.includes(D.color) ? '' : D.color;
  $('#sheet').querySelectorAll('[data-stored]').forEach(b => b.classList.toggle('on', !!b.dataset.stored === D.stored));
  $('#fPlace').hidden = !D.stored;
  $('#fTrack').checked = D.track;
  const last = [...D.wears].sort().pop();
  $('#wears').hidden = !D.track || D.isNew;
  $('#wears').innerHTML = `<span>Worn <b>${wornThisYear(D)}×</b> in ${today().slice(0, 4)}${last ? ` · last ${niceDate(last)}` : ''}</span>
    <button type="button" data-a="wearLess" aria-label="One fewer wear">−</button><button type="button" data-a="wearMore" aria-label="Add a wear today">+</button>`;
}

function saveItem(more) {
  const { id, type, color, track, photo, wears } = D;
  const place = D.stored ? ($('#fPlace').value.trim() || 'Storage') : '';
  const it = { id, name: $('#fName').value.trim(), type, color, place, track, photo, wears, added: D.added || Date.now() };
  const i = S.items.findIndex(x => x.id === id);
  i < 0 ? S.items.push(it) : S.items[i] = it;
  save();
  D = null;
  more ? openItem(null, { type, place, track, trackTouched: true }) : closeSheet();
  render();
}

// Runs in the background so pieces can keep being added while a photo is cut out.
async function addPhoto(file) {
  const d = D, id = d.id;
  const status = t => { d.status = t; if (D === d) paint(); };
  let kind = 'cut', color;
  status('Cutting out…');
  try {
    const { cutout, plain } = await import('./cutout.js');
    try {
      const r = await cutout(file, status);
      color = r.color;
      await putPhoto(id, r.blob);
    } catch (err) {
      console.warn('Cutout failed, keeping the plain photo', err);
      kind = 'raw';
      await putPhoto(id, await plain(file));
    }
  } catch (err) {
    console.warn(err);
    status('');
    return toast("Couldn't read that photo");
  }
  d.status = '';
  const saved = item(id);
  if (!saved && D !== d) return delPhoto(id); // sheet was closed without saving
  for (const t of [saved, D === d ? d : null]) {
    if (!t) continue;
    t.photo = kind;
    if (color && !d.colorTouched) t.color = color;
  }
  if (saved) { save(); render(); }
  if (D === d) paint();
}

function openWish(w) {
  W = w ? { ...w } : { id: uid(), name: '', url: '', price: '', note: '', isNew: true };
  openSheet(`<form id="wishForm">${head(W.isNew ? 'New wish' : 'Edit wish')}
    <label class="field"><span>What is it</span><input id="wName" value="${esc(W.name)}" placeholder="Linen blazer" autocomplete="off"></label>
    <label class="field"><span>Link</span><input id="wUrl" inputmode="url" autocapitalize="off" value="${esc(W.url)}" placeholder="Paste the shop link" autocomplete="off"></label>
    <label class="field"><span>Price</span><input id="wPrice" value="${esc(W.price)}" placeholder="$120" autocomplete="off"></label>
    <label class="field"><span>Note</span><input id="wNote" value="${esc(W.note)}" placeholder="Size, colour, wait for a sale…" autocomplete="off"></label>
    <button class="btn primary wide">Save</button>
    ${W.isNew ? '' : `<button type="button" class="btn soft wide" data-a="got">Got it, move to closet</button>
      <button type="button" class="quiet danger" data-a="delWish">Delete</button>`}
  </form>`);
}

async function openBackup() {
  openSheet(`${head('Backup &amp; storage')}
    <p class="muted" id="usage">Your wardrobe lives only on this phone.</p>
    <button class="btn primary wide" data-a="export">Save a backup file</button>
    <label class="btn soft wide"><input type="file" accept="application/json,.json" id="restore" class="vh">Restore from a backup file</label>
    <p class="hint">A backup holds every piece, photo, outfit and wish. Keep one in Files or iCloud in case you change phones.</p>`);
  const photos = await store('readonly', s => s.getAll()).catch(() => []);
  const mb = photos.reduce((n, b) => n + b.size, 0) / 1e6;
  if ($('#usage')) $('#usage').textContent = `${S.items.length} pieces, ${photos.length} photos using ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB on this phone.`;
}

const dataUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
async function exportBackup() {
  const photos = {};
  const [keys, blobs] = await Promise.all([store('readonly', s => s.getAllKeys()), store('readonly', s => s.getAll())]);
  for (let i = 0; i < keys.length; i++) photos[keys[i]] = await dataUrl(blobs[i]);
  const file = new File([JSON.stringify({ wardrobe: 1, state: S, photos })], `wardrobe-${today()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] }).catch(() => {});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function restoreBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch {}
  if (!data?.wardrobe || !Array.isArray(data.state?.items)) return toast("That isn't a wardrobe backup");
  if (!confirm(`Replace everything on this phone with the backup (${data.state.items.length} pieces)?`)) return;
  S = { ...BLANK, ...data.state };
  save();
  await store('readwrite', s => s.clear());
  [...urls.keys()].forEach(id => showPhoto(id));
  for (const [id, url] of Object.entries(data.photos || {})) await putPhoto(id, await (await fetch(url)).blob());
  closeSheet();
  render();
  toast('Backup restored');
}

let toastTimer;
function toast(text, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(text)}</span>${undo ? '<button data-a="undo">Undo</button>' : ''}`;
  t.hidden = false;
  toast.undo = undo;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, undo ? 6000 : 2500);
}

/* ---------- actions ---------- */
const actions = {
  tab(el) { tab = el.dataset.tab; render(); scrollTo(0, 0); },
  view(el) { view = el.dataset.view; render(); },
  filter(el) { filter = el.dataset.cat; render(); },
  add() { tab === 'wish' ? openWish() : openItem(); },
  edit(el) { openItem(item(el.dataset.id)); },
  close: closeSheet,
  backup: openBackup,
  export: exportBackup,

  // The plus circle: toggles a piece in today's outfit without redrawing the closet.
  pick(el) {
    const id = el.dataset.id, i = S.outfit.indexOf(id);
    i < 0 ? S.outfit.push(id) : S.outfit.splice(i, 1);
    save();
    el.classList.toggle('on', i < 0);
    el.setAttribute('aria-pressed', i < 0);
    el.firstElementChild.innerHTML = i < 0 ? ICON.check : ICON.plus;
    $('#badge').hidden = !S.outfit.length;
    $('#badge').textContent = S.outfit.length;
  },
  unpick(el) { S.outfit = S.outfit.filter(id => id !== el.dataset.id); save(); render(); },
  clear() { S.outfit = []; save(); render(); },
  wore() {
    const before = JSON.stringify(S), date = today();
    S.outfit.map(item).forEach(it => { if (it?.track) it.wears.push(date); });
    S.log.unshift({ date, ids: S.outfit });
    S.outfit = [];
    save(); render();
    toast('Logged for today', () => { S = JSON.parse(before); save(); render(); });
  },
  again(el) {
    S.outfit = S.log[el.dataset.i].ids.filter(item);
    save(); render(); scrollTo(0, 0);
  },
  undo() { toast.undo?.(); $('#toast').hidden = true; },

  type(el) {
    D.type = el.dataset.type;
    if (!D.trackTouched) D.track = COUNTED.includes(cat(D));
    paint();
  },
  color(el) { D.color = el.dataset.color; D.colorTouched = true; paint(); },
  where(el) { D.stored = !!el.dataset.stored; paint(); if (D.stored) $('#fPlace').focus(); },
  wearMore() { D.wears.push(today()); paint(); },
  wearLess() { D.wears.sort().pop(); paint(); },
  rmphoto() {
    D.photo = '';
    const it = item(D.id);
    if (it) { it.photo = ''; save(); render(); }
    delPhoto(D.id).then(paint);
  },
  saveMore() { saveItem(true); },
  del() {
    if (!confirm(`Delete ${label(D)}?`)) return;
    const id = D.id;
    S.items = S.items.filter(i => i.id !== id);
    S.outfit = S.outfit.filter(x => x !== id);
    save(); delPhoto(id); closeSheet(); render();
  },

  wish(el) { openWish(S.wishes.find(w => w.id === el.dataset.id)); },
  delWish() { S.wishes = S.wishes.filter(w => w.id !== W.id); save(); closeSheet(); render(); },
  got() {
    const name = $('#wName').value.trim();
    S.wishes = S.wishes.filter(w => w.id !== W.id);
    save(); W = null; tab = 'closet'; render();
    openItem(null, { name });
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (el && actions[el.dataset.a]) actions[el.dataset.a](el);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'itemForm') return saveItem(false);
  let url = $('#wUrl').value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  const w = { id: W.id, name: $('#wName').value.trim(), url, price: $('#wPrice').value.trim(), note: $('#wNote').value.trim() };
  const i = S.wishes.findIndex(x => x.id === w.id);
  i < 0 ? S.wishes.unshift(w) : S.wishes[i] = w;
  save(); closeSheet(); render();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'file' && el.files[0]) { addPhoto(el.files[0]); el.value = ''; }
  if (el.id === 'restore' && el.files[0]) restoreBackup(el.files[0]);
  if (el.id === 'fTrack') { D.track = el.checked; D.trackTouched = true; paint(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'fColor') { D.color = e.target.value; D.colorTouched = true; paint(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

render();
loadPhotos().then(render).catch(err => console.warn('Photos unavailable', err));
navigator.storage?.persist?.(); // ask the browser not to clear photos when the phone runs low on space
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
