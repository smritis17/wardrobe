// Smriti's Wardrobe: closet, outfit planning and wish list.
// Everything stays on this phone: details in localStorage, photos in IndexedDB.
// Two things leave it, only when used: your city's coordinates (weather) and a wish's shop link (its photo).

const KEY = 'wardrobe.v1';
const BLANK = { items: [], outfits: [], active: null, wishes: [], labels: [], place: null, look: 'wide', palette: 'bordeaux' };
let S = { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

// type -> [label, category]
const TYPES = {
  tee: ['Tee', 'Tops'], sweater: ['Long sleeve', 'Tops'], tank: ['Tank', 'Tops'],
  pants: ['Trousers', 'Bottoms'], shorts: ['Shorts', 'Bottoms'], skirt: ['Skirt', 'Bottoms'],
  dress: ['Dress', 'Dresses'], coat: ['Jacket', 'Outerwear'],
  shoe: ['Shoes', 'Shoes'], boot: ['Boots', 'Shoes'], heel: ['Heels', 'Shoes'],
  bag: ['Bag', 'Bags'], shades: ['Sunglasses', 'Sunglasses'], hat: ['Hat', 'Accessories'], gem: ['Jewellery', 'Accessories'],
};
const CATS = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Sunglasses', 'Accessories'];
const COUNTED = ['Tops', 'Bottoms', 'Dresses', 'Outerwear']; // wears are counted for clothing only
const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
const OCCASIONS = ['Everyday', 'Work', 'Workout', 'Going out'];
// heading type styles: key -> [name, font for its sample letter in Settings]; the full styles are in styles.css
const LOOKS = { wide: ['Wide', '800 1rem Syne'], editorial: ['Editorial', 'italic 400 1.5rem "Instrument Serif"'], didone: ['Didone', '500 1.25rem "Bodoni Moda"'],
  poster: ['Poster', '400 1.5rem "Bebas Neue"'], classic: ['Classic', '500 1.5rem "Cormorant Garamond"'], mono: ['Mono', '500 1.1rem "DM Mono"'] };
// palette -> [name, ground, accent] (the two colours on its swatch in Settings; the full set is in styles.css)
const PALETTES = { bordeaux: ['Bordeaux', '#2b0912', '#dcb67f'], cocoa: ['Cocoa', '#2a1810', '#a6ceff'], garnet: ['Garnet', '#ffffff', '#8f1024'] };
const PALETTE = ['#2a2227', '#5b5560', '#a9a5a8', '#f4f1ea', '#e9dcc3', '#c9b79a', '#9a7b5b', '#5e4034', '#7a2738', '#b8475a',
  '#e9a3b5', '#d9783c', '#e8c66a', '#6d7f5c', '#3f7a56', '#a9c3e0', '#4a6fa5', '#26324a', '#7b5ea7', '#c3b1e1'];
const FAMILIES = [['Black', '#2a2227'], ['Grey', '#a9a5a8'], ['White', '#f4f1ea'], ['Neutral', '#c9b79a'], ['Brown', '#6b4a3a'], ['Red', '#b8475a'],
  ['Pink', '#e9a3b5'], ['Orange', '#d9783c'], ['Yellow', '#e8c66a'], ['Green', '#6d7f5c'], ['Blue', '#4a6fa5'], ['Purple', '#7b5ea7']];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const iso = d => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const today = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return iso(x); };
const fmt = (d, o) => new Date(d + 'T12:00').toLocaleDateString(undefined, o);
const niceDate = d => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
const whenLabel = d => !d ? 'Someday' : d === today() ? 'Today' : d === addDays(today(), 1) ? 'Tomorrow' : niceDate(d);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const money = n => '$' + (n % 1 ? n.toFixed(2) : n.toLocaleString());
const amount = s => parseFloat(String(s).replace(/[^0-9.]/g, '')) || '';
const hexOk = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#a9a5a8';
const cat = it => (TYPES[it.type] || TYPES.tee)[1];
const label = it => it.name || (TYPES[it.type] || TYPES.tee)[0];
const counted = it => COUNTED.includes(cat(it));
const item = id => S.items.find(i => i.id === id);
const outfit = id => S.outfits.find(o => o.id === id);
const active = () => outfit(S.active); // the outfit the plus circles are adding to
const wornThisYear = it => it.wears.filter(d => d.startsWith(today().slice(0, 4))).length;

let tab = 'closet', view = 'pieces', filter = 'All', day = today();
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

/* ---------- weather (Open-Meteo: free, no account) ---------- */
const WX_KEY = 'wardrobe.wx';
let WX = JSON.parse(localStorage.getItem(WX_KEY) || 'null'); // { at, lat, lon, days: { date: { hi, lo, rain, code } } }, in °C
const FAHRENHEIT = /-(US|LR|MM)$/.test(navigator.language);
const temp = c => Math.round(FAHRENHEIT ? c * 9 / 5 + 32 : c) + '°';
const forecast = d => S.place && WX && WX.lat === S.place.lat && WX.lon === S.place.lon ? WX.days[d] : null;
async function loadWeather() {
  const p = S.place;
  if (!p || (forecast(today()) && Date.now() - WX.at < 3 * 3600e3)) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&timezone=auto&forecast_days=14` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
    const d = (await r.json()).daily;
    WX = { at: Date.now(), lat: p.lat, lon: p.lon, days: {} };
    d.time.forEach((t, i) => WX.days[t] = { hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i], rain: d.precipitation_probability_max[i], code: d.weather_code[i] });
    localStorage.setItem(WX_KEY, JSON.stringify(WX));
    if (tab === 'plan') render();
  } catch (err) { console.warn('Weather unavailable', err); }
}
const SNOW = [71, 73, 75, 77, 85, 86];
const wxWord = c => c === 0 ? 'Clear' : c === 1 ? 'Mostly clear' : c === 2 ? 'Partly cloudy' : c === 3 ? 'Cloudy' : c < 50 ? 'Fog'
  : c < 60 ? 'Drizzle' : c < 70 ? 'Rain' : c < 80 ? 'Snow' : c < 83 ? 'Showers' : c < 90 ? 'Snow showers' : 'Thunderstorms';
const CLOUD = 'M7 16h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 6.9 9.3 3.4 3.4 0 0 0 7 16z';
function wxIcon(c) {
  const d = c < 2 ? '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>'
    : c < 50 ? `<path d="${CLOUD}"/>`
    : SNOW.includes(c) ? `<path d="${CLOUD}M8 20h.01M12 21h.01M16 20h.01"/>` : `<path d="${CLOUD}M9 18.5l-1 2.5M13 18.5l-1 2.5M17 18.5l-1 2.5"/>`;
  return `<svg class="wxi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
function advice(w) {
  const bits = [];
  if (w.rain >= 50) bits.push(SNOW.includes(w.code) ? 'Snow likely.' : 'Rain likely.');
  if (w.hi < 10) bits.push('Cold enough for a coat.');
  else if (w.hi >= 27) bits.push('Hot, so dress light.');
  else if (w.lo < 8) bits.push('Chilly early and late, so bring a layer.');
  return bits.join(' ');
}
// Pieces whose season tags don't fit the day's forecast, as a sentence.
function clashes(ids, w) {
  if (!w) return '';
  const odd = ids.map(item).filter(it => it?.seasons?.length &&
    ((w.hi < 10 && !it.seasons.includes('Winter')) || (w.hi >= 27 && !it.seasons.includes('Summer'))));
  return odd.length ? `<p class="warn">${odd.map(it => `${esc(label(it))} is a ${it.seasons.join(' and ').toLowerCase()} piece.`).join(' ')}</p>` : '';
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
const tint = it => `style="--c:${hexOk(it.color)}"`; // tiles are tinted with the piece's own colour
function tile(it) {
  const on = !!active()?.ids.includes(it.id), n = counted(it) && wornThisYear(it);
  return `<figure class="piece${it.place ? ' stored' : ''}">
    <button class="t" ${tint(it)} data-a="edit" data-id="${it.id}" aria-label="${esc(label(it))}">${art(it)}${it.place ? `<span class="tag">${esc(it.place)}</span>` : ''}</button>
    <button class="pick${on ? ' on' : ''}" data-a="pick" data-id="${it.id}" aria-pressed="${on}" aria-label="Add to outfit: ${esc(label(it))}"><span>${on ? ICON.check : ICON.plus}</span></button>
    <figcaption><b>${esc(label(it))}</b>${n ? `<span>${n}×</span>` : ''}</figcaption>
  </figure>`;
}
const minis = ids => `<span class="minis">${ids.map(item).filter(Boolean).map(it => `<span class="t" ${tint(it)}>${art(it)}</span>`).join('')}</span>`;
const byCat = (a, b) => CATS.indexOf(cat(a)) - CATS.indexOf(cat(b)) || (b.added || 0) - (a.added || 0);

/* ---------- screens ---------- */
function render() {
  const root = document.documentElement;
  if (!LOOKS[S.look]) S.look = 'wide';          // styles and palettes that have since been removed
  if (!PALETTES[S.palette]) S.palette = 'bordeaux';
  root.dataset.look = S.look;
  root.dataset.palette = S.palette;
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.content = getComputedStyle(root).getPropertyValue('--bg').trim());
  $('#title').textContent = { closet: 'Closet', plan: 'Outfits', wish: 'Wish list' }[tab];
  $('#add').textContent = tab === 'wish' ? 'Add wish' : 'Add piece';
  $('#add').hidden = tab === 'plan';
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#main').innerHTML = { closet, plan, wish: wishScreen }[tab]();
  chrome();
}
// The badge and the "adding to" bar, which change without redrawing the closet.
function chrome() {
  const a = active();
  $('#badge').hidden = !a;
  $('#badge').textContent = a ? a.ids.length : '';
  $('#building').hidden = !a || tab !== 'closet';
  if (a) $('#buildingText').textContent = `${a.label || 'New outfit'} · ${whenLabel(a.date)} · ${plural(a.ids.length, 'piece')}`;
}

function closet() {
  if (!S.items.length) return `<div class="empty"><p>Your closet is empty.</p>
    <p class="muted">Add a piece with a shape and a colour now, and photograph it whenever you like.</p>
    <button class="btn primary" data-a="add">Add your first piece</button>
    <button class="quiet" data-a="settings">Restore a backup</button></div>`;
  const seg = `<div class="seg">${[['pieces', 'Pieces'], ['colour', 'Colour'], ['storage', 'Storage'], ['wear', 'Wear']]
    .map(([v, l]) => `<button data-a="view" data-view="${v}" class="${view === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return seg + { pieces, colour, storage, wear }[view]() + `<button class="quiet foot" data-a="settings">Settings &amp; backup</button>`;
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
    return `<button class="chip" style="background:${c}" data-a="edit" data-id="${it.id}" aria-label="${esc(label(it))}">${shape(it.type, light ? 'rgba(20,20,24,.55)' : 'rgba(255,255,255,.8)')}</button>`;
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
    return `<h2 class="sub">${esc(p)} <span>${plural(list.length, 'piece')}</span></h2><div class="grid">${list.map(tile).join('')}</div>`;
  }).join('');
}

// Wear insights: what earns its place and what doesn't. Clothing only.
function wear() {
  const yr = today().slice(0, 4), clothes = S.items.filter(counted);
  if (!clothes.length) return `<div class="empty"><p>No clothing yet.</p><p class="muted">Wears are counted for tops, bottoms, dresses and outerwear.</p></div>`;
  const row = (it, val, pct) => `<button class="row" data-a="edit" data-id="${it.id}"><span class="t" ${tint(it)}>${art(it)}</span>
    <span class="what"><b>${esc(label(it))}</b>${pct == null ? '' : `<i style="width:${pct}%"></i>`}</span><span class="val">${val}</span></button>`;
  const top = clothes.filter(wornThisYear).sort((a, b) => wornThisYear(b) - wornThisYear(a)).slice(0, 5);
  const unworn = clothes.filter(i => !wornThisYear(i)).sort(byCat);
  const perWear = it => it.price / Math.max(1, it.wears.length);
  const priced = clothes.filter(i => i.price > 0).sort((a, b) => perWear(b) - perWear(a));
  return (top.length ? `<h2 class="sub">Most worn in ${yr}</h2>${top.map(it => row(it, wornThisYear(it) + '×', wornThisYear(it) / wornThisYear(top[0]) * 100)).join('')}` : '')
    + `<h2 class="sub">Not worn in ${yr} <span>${unworn.length} of ${clothes.length}</span></h2>`
    + (unworn.length ? `<div class="grid">${unworn.map(tile).join('')}</div>` : `<p class="muted">Everything has been worn at least once.</p>`)
    + `<h2 class="sub">Cost per wear${priced.length ? ` <span>${money(priced.reduce((n, i) => n + i.price, 0))} on ${plural(priced.length, 'piece')}</span>` : ''}</h2>`
    + (priced.length ? priced.slice(0, 8).map(it => row(it, it.wears.length ? money(Math.round(perWear(it) * 100) / 100) + ' a wear' : money(it.price) + ', not worn')).join('')
      : `<p class="muted">Add what you paid to a piece and its cost per wear shows up here.</p>`);
}

function fitCard(o, w) {
  const act = o.worn ? `<span class="done">${ICON.check} Worn</span>`
    : `${o.date ? '' : `<button class="btn soft small" data-a="planHere" data-id="${o.id}">Plan for ${whenLabel(day).toLowerCase()}</button>`}
       <button class="btn primary small" data-a="wore" data-id="${o.id}">Wore it</button>`;
  return `<article class="fit"><button class="fit-main" data-a="${o.worn ? 'again' : 'editOutfit'}" data-id="${o.id}" aria-label="${o.worn ? 'Wear again' : 'Edit'}: ${esc(o.label || 'outfit')}">
      <b>${esc(o.label || 'Outfit')}</b>${minis(o.ids)}</button>
    ${o.worn ? '' : clashes(o.ids, w)}
    <div class="fit-acts">${act}</div></article>`;
}

function plan() {
  const a = active(), w = forecast(day), tomorrow = addDays(today(), 1);
  const strip = `<div class="days">${Array.from({ length: 10 }, (_, i) => addDays(today(), i)).map(d => {
    const x = forecast(d), has = S.outfits.some(o => o.date === d);
    return `<button data-a="day" data-d="${d}" class="${d === day ? 'on' : ''}" aria-label="${niceDate(d)}"><span>${d === today() ? 'Today' : fmt(d, { weekday: 'short' })}</span>
      <b>${+d.slice(8)}</b>${x ? `${wxIcon(x.code)}<small>${temp(x.hi)}</small>` : ''}${has ? '<i></i>' : ''}</button>`;
  }).join('')}</div>`;
  const wx = w ? `<p class="wx">${wxWord(w.code)}, ${temp(w.hi)} / ${temp(w.lo)}${w.rain == null ? '' : `, ${w.rain}% chance of rain`}.${advice(w) ? ` <b>${advice(w)}</b>` : ''}</p>`
    : S.place ? '' : `<button class="quiet left" data-a="settings">Add your city to see the weather</button>`;

  let build = '';
  if (a) {
    const occasions = [...new Set([...OCCASIONS, ...S.labels, a.label].filter(Boolean))];
    const picked = a.date && a.date !== today() && a.date !== tomorrow;
    build = `<section class="build"><h2 class="sub">Building an outfit <span>${plural(a.ids.length, 'piece')}</span></h2>
      <div class="grid">${a.ids.map(item).filter(Boolean).map(it => `<figure class="piece">
        <button class="t" ${tint(it)} data-a="edit" data-id="${it.id}" aria-label="${esc(label(it))}">${art(it)}</button>
        <button class="pick" data-a="unpick" data-id="${it.id}" aria-label="Remove ${esc(label(it))}"><span>${ICON.x}</span></button>
        <figcaption><b>${esc(label(it))}</b></figcaption></figure>`).join('')}
        <button class="t more" data-a="tab" data-tab="closet" aria-label="Add more pieces">${ICON.plus}</button></div>
      ${clashes(a.ids, forecast(a.date))}
      <div class="field"><span>Occasion</span><div class="chips wrap">${occasions.map(l => `<button data-a="occasion" data-l="${esc(l)}" class="${a.label === l ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
        <input id="oLabel" placeholder="Something else, like Maya's wedding" autocomplete="off" enterkeyhint="done"></div>
      <div class="field"><span>When</span><div class="chips wrap">
        <button data-a="when" data-d="${today()}" class="${a.date === today() ? 'on' : ''}">Today</button>
        <button data-a="when" data-d="${tomorrow}" class="${a.date === tomorrow ? 'on' : ''}">Tomorrow</button>
        <label class="${picked ? 'on' : ''}">${picked ? niceDate(a.date) : 'Pick a day'}<input type="date" id="oDate" min="${today()}" value="${a.date}"></label>
        <button data-a="when" data-d="" class="${a.date ? '' : 'on'}">Someday</button></div></div>
      <button class="btn primary wide" data-a="done">Done</button>
      <button class="quiet danger" data-a="delOutfit">Delete this outfit</button></section>`;
  }

  const todays = S.outfits.filter(o => o.date === day && o !== a);
  const waiting = S.outfits.filter(o => !o.date && !o.worn && o !== a);
  const past = S.outfits.filter(o => o.worn && o.date < today()).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6);
  const dayList = todays.length ? todays.map(o => fitCard(o, w)).join('')
    : a ? '' : `<div class="empty small"><p class="muted">Nothing planned for ${whenLabel(day).toLowerCase()}. Tap the plus on pieces in your closet to build an outfit.</p>
        <button class="btn primary" data-a="tab" data-tab="closet">Open closet</button></div>`;
  return strip + wx + build + (todays.length && a ? `<h2 class="sub">${whenLabel(day)}</h2>` : '') + dayList
    + (waiting.length ? `<h2 class="sub">Waiting to wear</h2>${waiting.map(o => fitCard(o)).join('')}` : '')
    + (past.length ? `<h2 class="sub">Worn lately <span>tap to wear again</span></h2>${past.map(o =>
      `<button class="past" data-a="again" data-id="${o.id}"><span class="when">${niceDate(o.date)}${o.label ? `<br>${esc(o.label)}` : ''}</span>${minis(o.ids)}</button>`).join('')}` : '');
}

function wishScreen() {
  if (!S.wishes.length) return `<div class="empty"><p>Nothing on your wish list.</p><p class="muted">Paste a shop link and the photo is fetched for you.</p>
    <button class="btn primary" data-a="add">Add a wish</button></div>`;
  return S.wishes.map(w => {
    let host = '';
    try { host = new URL(w.url).hostname.replace(/^www\./, ''); } catch {}
    const meta = [host, w.price].filter(Boolean).map(esc).join(' · ');
    const body = `${w.img ? `<img class="thumb" src="${esc(w.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <span class="what"><b>${esc(w.name || host || 'Untitled')}</b>${meta ? `<span>${meta}</span>` : ''}${w.note ? `<span>${esc(w.note)}</span>` : ''}</span>`;
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
  D = it ? { seasons: [], price: '', ...it, wears: [...it.wears], colorTouched: true }
    : { id: uid(), name: '', type: 'tee', color: '#f4f1ea', place: '', photo: '', wears: [], seasons: [], price: '', isNew: true, ...preset };
  D.seasons = [...D.seasons];
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
    <details class="extra"${D.seasons.length || D.price ? ' open' : ''}><summary>Season and price</summary>
      <div class="field"><span>Season (leave empty for all year)</span><div class="chips wrap">${SEASONS.map(s =>
        `<button type="button" data-a="season" data-s="${s}">${s}</button>`).join('')}</div></div>
      <label class="field"><span>Price paid (optional)</span><input id="fPrice" value="${esc(D.price)}" inputmode="decimal" placeholder="$" autocomplete="off" enterkeyhint="done"></label>
    </details>
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
  $('#pv').style.setProperty('--c', hexOk(D.color));
  $('#photoBtn').textContent = D.photo ? 'Replace photo' : 'Add photo';
  $('#photoHint').textContent = D.status || (D.photo === 'raw' ? 'Saved without a cutout. Add the photo again to retry.'
    : D.photo ? '' : 'Optional. The background is removed for you.');
  $('#rmPhoto').hidden = !D.photo || !!D.status;
  const on = (sel, test) => $('#sheet').querySelectorAll(sel).forEach(b => b.classList.toggle('on', test(b.dataset)));
  on('[data-type]', d => d.type === D.type);
  on('[data-color]', d => d.color === D.color);
  on('[data-stored]', d => !!d.stored === D.stored);
  on('[data-s]', d => D.seasons.includes(d.s));
  $('#sheet .custom').classList.toggle('on', !PALETTE.includes(D.color));
  $('#sheet .custom').style.background = PALETTE.includes(D.color) ? '' : D.color;
  $('#fPlace').hidden = !D.stored;
  const last = [...D.wears].sort().pop();
  $('#wears').hidden = !counted(D) || D.isNew;
  $('#wears').innerHTML = `<span>Worn <b>${wornThisYear(D)}×</b> in ${today().slice(0, 4)}${last ? ` · last ${niceDate(last)}` : ''}</span>
    <button type="button" data-a="wearLess" aria-label="One fewer wear">−</button><button type="button" data-a="wearMore" aria-label="Add a wear today">+</button>`;
}

function saveItem(more) {
  const { id, type, color, photo, wears, seasons } = D;
  const place = D.stored ? ($('#fPlace').value.trim() || 'Storage') : '';
  const it = { id, name: $('#fName').value.trim(), type, color, place, photo, wears, seasons, price: amount($('#fPrice').value), added: D.added || Date.now() };
  const i = S.items.findIndex(x => x.id === id);
  i < 0 ? S.items.push(it) : S.items[i] = it;
  save();
  D = null;
  more ? openItem(null, { type, place, seasons }) : closeSheet();
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
  W = w ? { ...w } : { id: uid(), name: '', url: '', price: '', note: '', img: '', isNew: true };
  openSheet(`<form id="wishForm">${head(W.isNew ? 'New wish' : 'Edit wish')}
    <label class="field"><span>Link</span><input id="wUrl" inputmode="url" autocapitalize="off" value="${esc(W.url)}" placeholder="Paste the shop link" autocomplete="off"></label>
    <label class="field"><span>What is it</span><input id="wName" value="${esc(W.name)}" placeholder="Leave empty to use the shop's title" autocomplete="off"></label>
    <label class="field"><span>Price</span><input id="wPrice" value="${esc(W.price)}" placeholder="$120" autocomplete="off"></label>
    <label class="field"><span>Note</span><input id="wNote" value="${esc(W.note)}" placeholder="Size, colour, wait for a sale…" autocomplete="off"></label>
    <button class="btn primary wide">Save</button>
    ${W.isNew ? '' : `<button type="button" class="btn soft wide" data-a="got">Got it, move to closet</button>
      <button type="button" class="quiet danger" data-a="delWish">Delete</button>`}
  </form>`);
}
// Fetch the shop page's photo (and its title, if the wish has no name) through microlink.io's free preview service.
async function preview(id, url) {
  try {
    const d = (await (await fetch('https://api.microlink.io/?url=' + encodeURIComponent(url))).json()).data || {};
    const w = S.wishes.find(x => x.id === id);
    if (!w || w.url !== url) return;
    w.img = d.image?.url || '';
    if (!w.name && d.title) w.name = d.title.slice(0, 80);
    save();
    if (tab === 'wish') render();
  } catch (err) { console.warn('No preview for', url, err); }
}

async function openSettings() {
  openSheet(`${head('Settings')}
    <div class="field"><span>Colour</span><div class="pal">${Object.entries(PALETTES).map(([k, [name, ground, accent]]) =>
      `<button data-a="palette" data-p="${k}" class="${S.palette === k ? 'on' : ''}"><i style="background:linear-gradient(135deg,${ground} 50%,${accent} 50%)"></i>${name}</button>`).join('')}</div></div>
    <div class="field"><span>Type</span><div class="pal">${Object.entries(LOOKS).map(([k, [name, font]]) =>
      `<button data-a="look" data-look="${k}" class="${S.look === k ? 'on' : ''}"><b style="font:${esc(font)}">Aa</b>${name}</button>`).join('')}</div></div>
    <div class="field"><span>Weather for ${S.place ? esc(S.place.name) : 'your city'}</span>
      <div class="inline"><input id="city" placeholder="${S.place ? 'Change city' : 'Type your city'}" autocomplete="off" enterkeyhint="search"><button class="btn soft small" data-a="findCity">Find</button></div>
      <div id="cities"></div>
      <button class="quiet left" data-a="locate">Use where I am now</button></div>
    <div class="field"><span>Backup</span>
      <p class="hint" id="usage">Your wardrobe lives only on this phone.</p>
      <button class="btn primary wide" data-a="export">Save a backup file</button>
      <label class="btn soft wide"><input type="file" accept="application/json,.json" id="restore" class="vh">Restore from a backup file</label></div>`);
  const photos = await store('readonly', s => s.getAll()).catch(() => []);
  const mb = photos.reduce((n, b) => n + b.size, 0) / 1e6;
  if ($('#usage')) $('#usage').textContent = `${plural(S.items.length, 'piece')} and ${plural(photos.length, 'photo')} using ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB, stored only on this phone.`;
}
function setPlace(p) {
  S.place = p;
  save(); loadWeather(); openSettings(); render();
  toast(`Weather set to ${p.name}`);
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
  if (!confirm(`Replace everything on this phone with the backup (${plural(data.state.items.length, 'piece')})?`)) return;
  S = { ...BLANK, ...data.state };
  save();
  await store('readwrite', s => s.clear());
  [...urls.keys()].forEach(id => showPhoto(id));
  for (const [id, url] of Object.entries(data.photos || {})) await putPhoto(id, await (await fetch(url)).blob());
  closeSheet(); loadWeather(); render();
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
function endOutfit() { // stop adding to the active outfit; an empty one isn't kept
  const a = active();
  if (a && !a.ids.length) S.outfits = S.outfits.filter(o => o !== a);
  S.active = null;
}
function startOutfit(o) {
  endOutfit();
  if (day < today()) day = today();
  const a = { id: uid(), label: '', date: day, ids: [], worn: false, ...o };
  S.outfits.push(a);
  S.active = a.id;
  return a;
}
const actions = {
  tab(el) {
    tab = el.dataset.tab;
    const a = active();
    if (tab === 'plan' && a?.date) day = a.date;
    render(); scrollTo(0, 0);
  },
  view(el) { view = el.dataset.view; render(); },
  filter(el) { filter = el.dataset.cat; render(); },
  add() { tab === 'wish' ? openWish() : openItem(); },
  edit(el) { openItem(item(el.dataset.id)); },
  close: closeSheet,
  settings: openSettings,
  export: exportBackup,

  // The plus circle: toggles a piece in the outfit being built, without redrawing the closet.
  pick(el) {
    const id = el.dataset.id, a = active() || startOutfit(), i = a.ids.indexOf(id);
    i < 0 ? a.ids.push(id) : a.ids.splice(i, 1);
    if (!a.ids.length) endOutfit();
    save();
    el.classList.toggle('on', i < 0);
    el.setAttribute('aria-pressed', i < 0);
    el.firstElementChild.innerHTML = i < 0 ? ICON.check : ICON.plus;
    chrome();
  },
  unpick(el) {
    const a = active();
    a.ids = a.ids.filter(id => id !== el.dataset.id);
    if (!a.ids.length) endOutfit();
    save(); render();
  },
  occasion(el) { active().label = el.dataset.l; save(); render(); },
  when(el) { const a = active(); a.date = el.dataset.d; if (a.date) day = a.date; save(); render(); },
  done() { endOutfit(); save(); render(); },
  delOutfit() { S.outfits = S.outfits.filter(o => o.id !== S.active); S.active = null; save(); render(); },
  editOutfit(el) { endOutfit(); S.active = el.dataset.id; save(); render(); scrollTo(0, 0); },
  day(el) { day = el.dataset.d; render(); },
  planHere(el) { outfit(el.dataset.id).date = day; save(); render(); },
  wore(el) {
    const before = JSON.stringify(S), o = outfit(el.dataset.id);
    if (!o.date || o.date > today()) o.date = today();
    o.worn = true;
    o.ids.map(item).forEach(it => { if (it && counted(it)) it.wears.push(o.date); });
    day = o.date;
    save(); render();
    toast(`Logged for ${whenLabel(o.date).toLowerCase()}`, () => { S = JSON.parse(before); save(); render(); });
  },
  again(el) {
    const o = outfit(el.dataset.id);
    startOutfit({ label: o.label, ids: o.ids.filter(item) });
    save(); render(); scrollTo(0, 0);
  },
  undo() { toast.undo?.(); $('#toast').hidden = true; },

  type(el) { D.type = el.dataset.type; paint(); },
  color(el) { D.color = el.dataset.color; D.colorTouched = true; paint(); },
  where(el) { D.stored = !!el.dataset.stored; paint(); if (D.stored) $('#fPlace').focus(); },
  season(el) { const s = el.dataset.s, i = D.seasons.indexOf(s); i < 0 ? D.seasons.push(s) : D.seasons.splice(i, 1); paint(); },
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
    S.outfits.forEach(o => o.ids = o.ids.filter(x => x !== id));
    S.outfits = S.outfits.filter(o => o.ids.length);
    if (!active()) S.active = null;
    save(); delPhoto(id); closeSheet(); render();
  },

  wish(el) { openWish(S.wishes.find(w => w.id === el.dataset.id)); },
  delWish() { S.wishes = S.wishes.filter(w => w.id !== W.id); save(); closeSheet(); render(); },
  got() {
    const name = $('#wName').value.trim(), price = amount($('#wPrice').value);
    S.wishes = S.wishes.filter(w => w.id !== W.id);
    save(); W = null; tab = 'closet'; render();
    openItem(null, { name, price });
  },

  look(el) { S.look = el.dataset.look; save(); render(); openSettings(); },
  palette(el) { S.palette = el.dataset.p; save(); render(); openSettings(); },
  async findCity() {
    const q = $('#city').value.trim();
    if (!q) return;
    $('#cities').innerHTML = '<p class="hint">Looking…</p>';
    try {
      const r = (await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&name=' + encodeURIComponent(q))).json()).results || [];
      $('#cities').innerHTML = r.length ? r.map(c => {
        const name = [c.name, c.admin1, c.country_code].filter(Boolean).join(', ');
        return `<button class="btn soft small" data-a="city" data-name="${esc(name)}" data-lat="${c.latitude}" data-lon="${c.longitude}">${esc(name)}</button>`;
      }).join('') : '<p class="hint">No city by that name.</p>';
    } catch { $('#cities').innerHTML = '<p class="hint">Couldn\'t search right now. Check your connection.</p>'; }
  },
  city(el) { setPlace({ name: el.dataset.name, lat: +el.dataset.lat, lon: +el.dataset.lon }); },
  locate() {
    if (!navigator.geolocation) return toast("This phone won't share its location");
    navigator.geolocation.getCurrentPosition(
      p => setPlace({ name: 'where you are', lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }),
      () => toast("Couldn't get your location"));
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
  const w = { id: W.id, name: $('#wName').value.trim(), url, price: $('#wPrice').value.trim(), note: $('#wNote').value.trim(), img: url === W.url ? W.img : '' };
  const i = S.wishes.findIndex(x => x.id === w.id);
  i < 0 ? S.wishes.unshift(w) : S.wishes[i] = w;
  save(); closeSheet(); render();
  if (url && !w.img) preview(w.id, url);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'file' && el.files[0]) { addPhoto(el.files[0]); el.value = ''; }
  if (el.id === 'restore' && el.files[0]) restoreBackup(el.files[0]);
  if (el.id === 'oDate' && el.value) { active().date = day = el.value; save(); render(); }
  if (el.id === 'oLabel' && el.value.trim()) {
    const l = el.value.trim();
    active().label = l;
    if (!OCCASIONS.includes(l) && !S.labels.includes(l)) S.labels = [l, ...S.labels].slice(0, 6);
    save(); render();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'fColor') { D.color = e.target.value; D.colorTouched = true; paint(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if (e.key === 'Enter' && e.target.id === 'city') actions.findCity();
  if (e.key === 'Enter' && e.target.id === 'oLabel') e.target.blur();
});

// Plans whose day passed without being worn go back to "Waiting to wear".
S.outfits.forEach(o => { if (!o.worn && o.date && o.date < today()) o.date = ''; });
if (!active()) S.active = null;

render();
loadPhotos().then(render).catch(err => console.warn('Photos unavailable', err));
loadWeather();
navigator.storage?.persist?.(); // ask the browser not to clear photos when the phone runs low on space
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
