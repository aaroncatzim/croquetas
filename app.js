/* ============================================================
   Mascotlan POS · lógica de la aplicación
   Vanilla JS, sin dependencias.
   Persistencia:
     · Escritorio (Electron): archivos JSON en la carpeta de datos
       (productos.json, config.json, ventas/ventas-AAAA-MM-DD.json)
     · Navegador: localStorage (una clave por día para las ventas)
     · Supabase (opcional): login con correo/contraseña y catálogo
       de productos sincronizado. Ver supabase-config.js.
   ============================================================ */
'use strict';

/* ---------------------------------------------------------- config */
const CONFIG = {
  brandName: 'Mascotlan',
  startScreen: 'login',          // 'login' | 'pos' | 'inventory' | 'sales' | 'dashboard'
  lowStockThreshold: 10,
  cashFund: 260,                 // fondo inicial de caja para el corte
};
const STORAGE_KEY = 'mascotlan-pos-v1';
const SMOKE = /[?&]smoke=1/.test(location.search); // auto-prueba: index.html?smoke=1

/* Puente a Electron (preload.js). Ausente cuando corre en navegador. */
const FS = window.mascotlan || null;
/* Cliente Supabase; se crea en init() si hay configuración. */
let SB = null;

/* ---------------------------------------------------------- datos */
const CATS = {
  Alimento:   { c: '#E4622F', s: '#FCEBDE' },
  Higiene:    { c: '#158577', s: '#E3F1EE' },
  Accesorios: { c: '#7A5CC0', s: '#EEE9F8' },
  Juguetes:   { c: '#C08610', s: '#FAEFD6' },
  Preparada:  { c: '#C24D6B', s: '#F8E7EC' },
  Pasteles:   { c: '#E4622F', s: '#FCEBDE' },
};

const SEED_PRODUCTS = [
  { id: 'a1', name: 'Croqueta Perro Adulto',       cat: 'Alimento',   price: 78,  unit: 'kg',  stock: 118, barcode: '750112300011' },
  { id: 'a2', name: 'Croqueta Gato Indoor',        cat: 'Alimento',   price: 96,  unit: 'kg',  stock: 54,  barcode: '750112300028' },
  { id: 'a3', name: 'Bolsa Croqueta Premium 2kg',  cat: 'Alimento',   price: 315, unit: 'pza', stock: 24,  barcode: '750112300035' },
  { id: 'a4', name: 'Alimento Húmedo Lata 156g',   cat: 'Alimento',   price: 29,  unit: 'pza', stock: 8,   barcode: '750112300042' },
  { id: 'h1', name: 'Shampoo Antipulgas 500ml',    cat: 'Higiene',    price: 125, unit: 'pza', stock: 30,  barcode: '750112340016' },
  { id: 'h2', name: 'Pipeta Antipulgas',           cat: 'Higiene',    price: 149, unit: 'pza', stock: 41,  barcode: '750112340023' },
  { id: 'h3', name: 'Arena Sanitaria 5kg',         cat: 'Higiene',    price: 185, unit: 'pza', stock: 6,   barcode: '750112340030' },
  { id: 'h4', name: 'Toallitas Húmedas x80',       cat: 'Higiene',    price: 65,  unit: 'pza', stock: 48,  barcode: '750112340047' },
  { id: 'c1', name: 'Cama Acolchada Mediana',      cat: 'Accesorios', price: 439, unit: 'pza', stock: 9,   barcode: '750112360014' },
  { id: 'c2', name: 'Transportadora Chica',        cat: 'Accesorios', price: 569, unit: 'pza', stock: 5,   barcode: '750112360021' },
  { id: 'c3', name: 'Correa Retráctil 5m',         cat: 'Accesorios', price: 265, unit: 'pza', stock: 14,  barcode: '750112360038' },
  { id: 'c4', name: 'Collar Ajustable',            cat: 'Accesorios', price: 99,  unit: 'pza', stock: 0,   barcode: '750112360045' },
  { id: 'j1', name: 'Pelota Chillona',             cat: 'Juguetes',   price: 55,  unit: 'pza', stock: 62,  barcode: '750112380012' },
  { id: 'j2', name: 'Hueso de Nylon',              cat: 'Juguetes',   price: 85,  unit: 'pza', stock: 37,  barcode: '750112380029' },
  { id: 'j3', name: 'Ratón con Catnip',            cat: 'Juguetes',   price: 45,  unit: 'pza', stock: 44,  barcode: '750112380036' },
  { id: 'p1', name: 'Galletas Horneadas 200g',     cat: 'Preparada',  price: 72,  unit: 'pza', stock: 22,  barcode: '750112390011' },
  { id: 'p2', name: 'Pastel Cumple-perro',         cat: 'Preparada',  price: 159, unit: 'pza', stock: 6,   barcode: '750112390028' },
  { id: 'p3', name: 'Snack Natural Pollo 250g',    cat: 'Preparada',  price: 88,  unit: 'pza', stock: 19,  barcode: '750112390035' },
];

/* ---------------------------------------------------------- estado */
function emptyNp() {
  return { name: '', cat: 'Alimento', price: '', unit: 'pza', barcode: '', stock: '', img: '' };
}

const state = {
  screen: CONFIG.startScreen,
  role: 'dueno',
  userName: 'Aarón',
  products: SEED_PRODUCTS.map(p => ({ ...p })),
  cart: [],                       // [{id, qty}] piezas · [{id, weight}] granel
  query: '', cat: 'Todo', invQuery: '',
  weightId: null, weightVal: '0.500',
  tendered: '', contado: '',
  ticket: null, phone: '', waSent: false,
  folioSeq: 138,
  sales: [],                      // ventas de HOY (con estado 'ok' | 'cancelada')
  salesDate: todayKey(),
  week: {},                       // { 'AAAA-MM-DD': {total, count} } días anteriores
  showNewProduct: false,
  np: emptyNp(), npError: '',
  editId: null,                   // id del producto en edición (modal compartido con "nuevo")
  flashId: null,                  // producto recién creado/editado, se resalta en inventario
  confirmRevert: null,            // folio de la venta a revertir (modal de confirmación)
  confirmDelete: null,            // id del producto a borrar (modal de confirmación)
  login: { email: '', password: '', error: '', busy: false },
  syncMsg: '',                    // aviso de sincronización con Supabase
  dataPath: '',                   // carpeta de datos (solo escritorio)
  _focus: null,                   // data-key a enfocar tras el próximo render
};

/* ------------------------------------------------- almacenamiento */
/* En modo smoke dentro del navegador no se toca localStorage; en el
   escritorio (FS) sí se escribe, apuntando a una carpeta temporal. */
const PERSIST = FS ? true : !SMOKE;

const Store = FS ? {
  loadProducts: () => FS.loadProducts(),
  saveProducts: p  => FS.saveProducts(JSON.parse(JSON.stringify(p))),
  loadMeta:     () => FS.loadMeta(),
  saveMeta:     m  => FS.saveMeta(JSON.parse(JSON.stringify(m))),
  loadSales:    k  => FS.loadSales(k),
  saveSales: (k, s) => FS.saveSales(k, JSON.parse(JSON.stringify(s))),
  loadWeek:  keys  => FS.loadWeek(keys),
} : {
  loadProducts: async () => {
    const d = lsRead(STORAGE_KEY);
    return d && Array.isArray(d.products) && d.products.length ? d.products : null;
  },
  saveProducts: async p => lsWrite(STORAGE_KEY, { ...(lsRead(STORAGE_KEY) || {}), products: p }),
  loadMeta: async () => {
    const d = lsRead(STORAGE_KEY);
    return d && typeof d.folioSeq === 'number' ? { folioSeq: d.folioSeq } : null;
  },
  saveMeta: async m => lsWrite(STORAGE_KEY, { ...(lsRead(STORAGE_KEY) || {}), folioSeq: m.folioSeq }),
  loadSales: async k => lsRead(STORAGE_KEY + ':ventas:' + k) || [],
  saveSales: async (k, s) => lsWrite(STORAGE_KEY + ':ventas:' + k, s),
  loadWeek: async keys => {
    const out = {};
    keys.forEach(k => {
      const sales = lsRead(STORAGE_KEY + ':ventas:' + k) || [];
      out[k] = dayTotals(sales);
    });
    return out;
  },
};

function lsRead(key) {
  if (!PERSIST) return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
}
function lsWrite(key, val) {
  if (!PERSIST) return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) { /* sin almacenamiento */ }
}

function persistProducts() {
  if (!PERSIST) return;
  Promise.resolve(Store.saveProducts(state.products)).catch(() => {});
  if (SB && SB.hasSession()) {
    SB.upsertProducts(state.products)
      .then(() => { if (state.syncMsg) { state.syncMsg = ''; render(); } })
      .catch(() => { state.syncMsg = 'Sin conexión con Supabase — los cambios quedaron guardados localmente.'; render(); });
  }
}
function persistSales() {
  if (!PERSIST) return;
  Promise.resolve(Store.saveSales(state.salesDate, state.sales)).catch(() => {});
}
function persistMeta() {
  if (!PERSIST) return;
  Promise.resolve(Store.saveMeta({ folioSeq: state.folioSeq })).catch(() => {});
}

/* Cambio de día: las ventas de hoy pasan al histórico de la semana. */
function ensureToday() {
  const k = todayKey();
  if (state.salesDate === k) return;
  state.week[state.salesDate] = dayTotals(state.sales);
  state.salesDate = k;
  state.sales = [];
}

/* ------------------------------------------------------- supabase */
function makeSupabase(cfg) {
  if (!cfg || !cfg.url || !cfg.anonKey) return null;
  const base = String(cfg.url).replace(/\/+$/, '');
  let token = null;
  const headers = extra => ({
    'Content-Type': 'application/json',
    apikey: cfg.anonKey,
    Authorization: 'Bearer ' + (token || cfg.anonKey),
    ...extra,
  });
  return {
    hasSession: () => !!token,
    logout: () => { token = null; },
    async login(email, password) {
      const r = await fetch(base + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = d.error_description || d.msg || '';
        throw new Error(/invalid/i.test(msg) ? 'Correo o contraseña incorrectos.' : (msg || 'No se pudo iniciar sesión.'));
      }
      token = d.access_token;
      const pr = await fetch(base + '/rest/v1/perfiles?id=eq.' + d.user.id + '&select=nombre,rol', { headers: headers() });
      const perfil = pr.ok ? (await pr.json())[0] : null;
      if (!perfil) { token = null; throw new Error('El usuario no tiene perfil (agrega su fila en la tabla "perfiles").'); }
      return { nombre: perfil.nombre, rol: perfil.rol === 'dueno' ? 'dueno' : 'cajero' };
    },
    async fetchProducts() {
      const r = await fetch(base + '/rest/v1/productos?select=*&order=nombre', { headers: headers() });
      if (!r.ok) throw new Error('No se pudo leer el catálogo de Supabase.');
      return (await r.json()).map(row => ({
        id: String(row.id),
        name: row.nombre,
        cat: CATS[row.categoria] ? row.categoria : 'Alimento',
        price: Number(row.precio),
        unit: row.unidad === 'kg' ? 'kg' : 'pza',
        stock: Number(row.stock) || 0,
        barcode: row.codigo_barras || '',
        img: row.imagen || '',
      }));
    },
    async upsertProducts(products) {
      const rows = withImg => products.map(p => {
        const row = {
          id: p.id, nombre: p.name, categoria: p.cat, precio: p.price,
          unidad: p.unit, stock: p.stock, codigo_barras: p.barcode,
          actualizado: new Date().toISOString(),
        };
        if (withImg) row.imagen = p.img || null;
        return row;
      });
      const send = body => fetch(base + '/rest/v1/productos', {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(body),
      });
      let r = await send(rows(true));
      // proyectos creados con el esquema anterior: sin columna "imagen"
      if (!r.ok) r = await send(rows(false));
      if (!r.ok) throw new Error('No se pudo sincronizar el catálogo con Supabase.');
    },
    async deleteProduct(id) {
      const r = await fetch(base + '/rest/v1/productos?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: headers(),
      });
      if (!r.ok) throw new Error('No se pudo borrar el producto en Supabase.');
    },
  };
}

/* ---------------------------------------------------------- helpers */
function pad2(n) { return String(n).padStart(2, '0'); }
function dateKeyOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayKey() { return dateKeyOf(new Date()); }
function todayStr() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function lastDays(n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    keys.push(dateKeyOf(d));
  }
  return keys;
}
function m(n) {
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function mono(name) {
  const w = String(name).split(' ').filter(x => x.length > 2);
  return ((w[0] || name).slice(0, 1) + (w[1] || '').slice(0, 1)).toUpperCase();
}
function catOf(c) { return CATS[c] || { c: '#8A7A6A', s: '#F1E6D4' }; }
/* Avatar de producto: foto si la tiene, monograma de color si no. */
function avatarHtml(p, size) {
  if (p && p.img) return `<div class="avatar ${size} has-img"><img src="${p.img}" alt=""></div>`;
  const cc = catOf(p ? p.cat : '');
  return `<div class="avatar ${size}" style="--c:${cc.c}">${mono(p ? p.name : '?')}</div>`;
}
/* Miniatura cuadrada (recorte centrado) en JPEG para guardar y sincronizar. */
function resizeImage(dataUrl, size = 256) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(im.width, im.height);
      if (!s) { reject(new Error('imagen vacía')); return; }
      const c = document.createElement('canvas');
      c.width = c.height = Math.min(size, s);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; // los PNG transparentes quedan sobre blanco
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    im.onerror = () => reject(new Error('imagen ilegible'));
    im.src = dataUrl;
  });
}
function pickImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    resizeImage(reader.result)
      .then(img => { state.np.img = img; state.npError = ''; render(); })
      .catch(() => { state.npError = 'No se pudo leer la imagen. Usa JPG, PNG o WebP.'; render(); });
  };
  reader.onerror = () => { state.npError = 'No se pudo leer el archivo.'; render(); };
  reader.readAsDataURL(file);
}
function findProduct(id) { return state.products.find(p => p.id === id); }
function round3(n) { return Math.round(n * 1000) / 1000; }
function round2(n) { return Math.round(n * 100) / 100; }
function fmtQty(n) { return String(round3(n)); }
function parseNum(s) { return parseFloat(String(s).replace(',', '.')); } // acepta "50,50"
function qtyLabel(l) { return l.unit === 'kg' ? l.q.toFixed(3) + ' kg' : l.q + ' pza'; }
function unitStr(l) { return m(l.price) + (l.unit === 'kg' ? ' / kg' : ' c/u'); }
function saleTime(s) {
  return new Date(s.iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function dayTotals(sales) {
  const ok = sales.filter(s => s.status === 'ok');
  return { total: round2(ok.reduce((a, s) => a + s.total, 0)), count: ok.length };
}
function todayStats() { return dayTotals(state.sales); }

function buildLines() {
  return state.cart.map((it, idx) => {
    const p = findProduct(it.id);
    const isKg = p.unit === 'kg';
    const q = isKg ? it.weight : it.qty;
    return { idx, p, isKg, qty: it.qty, weight: it.weight, q, lineTotal: p.price * q };
  });
}
function cartTotal() { return buildLines().reduce((a, l) => a + l.lineTotal, 0); }
function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  return state.products
    .filter(p => state.cat === 'Todo' || p.cat === state.cat)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q));
}

/* ---------------------------------------------------------- iconos */
const I = {
  paw: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="#fff"><ellipse cx="7" cy="9" rx="1.9" ry="2.5"/><ellipse cx="12" cy="7.3" rx="2" ry="2.7"/><ellipse cx="17" cy="9" rx="1.9" ry="2.5"/><path d="M12 12.4c-2.6 0-5 2-5 4.3 0 1.7 1.5 2.5 3 2.5 1 0 1.4-.4 2-.4s1 .4 2 .4c1.5 0 3-.8 3-2.5 0-2.3-2.4-4.3-5-4.3z"/></svg>`,
  cart: (s, sw, color) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.3 12.4a1.6 1.6 0 0 0 1.6 1.3h9.1a1.6 1.6 0 0 0 1.6-1.3L21 7H5.1"/></svg>`,
  box: () => `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>`,
  chart: () => `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l3.5-4 3 2.5L20 7"/></svg>`,
  receipt: () => `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  logout: () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
  search: () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B79B7A" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>`,
  trash: () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`,
  x: () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  plus: () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  arrow: () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  check: () => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#127567" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`,
  wallet: () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#127567" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>`,
  phone: () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B79B7A" stroke-width="2" stroke-linecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>`,
  wa: () => `<svg width="19" height="19" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.2-4.9-4.4-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.2.5.1.7-.1l.7-.9c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.1.1.7-.1 1.3z"/></svg>`,
  download: () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
  undo: () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>`,
  pencil: () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>`,
  lock: () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B79B7A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  mail: () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B79B7A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
};

/* ---------------------------------------------------------- vistas */
function html() {
  if (state.screen === 'login') return renderLogin();
  return renderShell() + renderWeightModal() + renderTicketModal()
       + renderNewProductModal() + renderRevertModal() + renderDeleteModal();
}

function renderLogin() {
  return `
  <div class="login">
    <div class="login-box">
      <header class="login-head">
        <div class="brand-row">
          <div class="logo logo-lg">${I.paw(34)}</div>
          <div class="brand-text">
            <div class="brand-name">${esc(CONFIG.brandName)}</div>
            <div class="brand-tag">Comida y artículos para tu mascota</div>
          </div>
        </div>
        <div class="login-sub">${SB ? 'Inicia sesión con tu cuenta' : 'Elige tu cuenta para comenzar el turno'}</div>
      </header>
      ${SB ? renderLoginForm() : renderLoginCards()}
      <div class="login-foot">Caja abierta · Turno del ${todayStr()}</div>
    </div>
  </div>`;
}

function renderLoginCards() {
  return `
  <div class="login-cards">
    <button class="login-card dueno" data-action="login-dueno">
      <div class="lc-head">
        <div class="avatar a58 grad-orange">A</div>
        <div>
          <div class="lc-name">Aarón</div>
          <div class="lc-role">Dueño</div>
        </div>
      </div>
      <div class="lc-desc">Acceso completo · Cobro, inventario, reportes y corte de caja.</div>
      <div class="lc-cta">Entrar ${I.arrow()}</div>
    </button>
    <button class="login-card cajero" data-action="login-cajero">
      <div class="lc-head">
        <div class="avatar a58 grad-teal">M</div>
        <div>
          <div class="lc-name">Mostrador 1</div>
          <div class="lc-role">Cajero</div>
        </div>
      </div>
      <div class="lc-desc">Solo cobro, ventas del día e inventario. Sin reportes ni corte.</div>
      <div class="lc-cta">Entrar ${I.arrow()}</div>
    </button>
  </div>`;
}

function renderLoginForm() {
  const f = state.login;
  return `
  <div class="login-form">
    <div class="field">
      <label>Correo</label>
      <div class="input-icon">${I.mail()}
        <input data-input="login.email" data-key="login_email" type="text" inputmode="email"
               autocomplete="username" autocapitalize="off" spellcheck="false"
               value="${esc(f.email)}" placeholder="tucorreo@ejemplo.com"${f.busy ? ' disabled' : ''}>
      </div>
    </div>
    <div class="field">
      <label>Contraseña</label>
      <div class="input-icon">${I.lock()}
        <input data-input="login.password" data-key="login_password" type="password" autocomplete="current-password"
               value="${esc(f.password)}" placeholder="••••••••"${f.busy ? ' disabled' : ''}>
      </div>
    </div>
    ${f.error ? `<div class="form-error">${esc(f.error)}</div>` : ''}
    <button class="btn-save block${f.busy ? ' off' : ''}" data-action="login-sb">
      ${f.busy ? 'Entrando…' : 'Iniciar sesión'}
    </button>
    <div class="login-note">Cuentas administradas en Supabase · el dueño ve reportes y corte</div>
  </div>`;
}

function renderShell() {
  const isDueno = state.role === 'dueno';
  const main =
    state.screen === 'inventory' ? renderInventory() :
    state.screen === 'sales' ? renderSales() :
    (state.screen === 'dashboard' && isDueno) ? renderDashboard() :
    renderPos();
  const sync = state.syncMsg ? `<div class="sync-banner">${esc(state.syncMsg)}</div>` : '';
  return `<div class="shell">${renderRail()}<main class="main">${sync}${main}</main></div>`;
}

function renderRail() {
  const isDueno = state.role === 'dueno';
  const roleColor = isDueno ? '#D9531B' : '#158577';
  const nav = (id, icon, label) =>
    `<button class="nav-btn${state.screen === id ? ' active' : ''}" data-action="nav" data-arg="${id}">${icon}${label}</button>`;
  return `
  <aside class="rail">
    <div class="rail-brand">
      <div class="logo logo-sm">${I.paw(23)}</div>
      <div>
        <div class="rail-name">${esc(CONFIG.brandName)}</div>
        <div class="rail-tag">Punto de venta</div>
      </div>
    </div>
    <nav class="rail-nav">
      ${nav('pos', I.cart(21), 'Cobrar')}
      ${nav('inventory', I.box(), 'Inventario')}
      ${nav('sales', I.receipt(), 'Ventas')}
      ${isDueno ? nav('dashboard', I.chart(), 'Panel del dueño') : ''}
    </nav>
    <div class="rail-foot">
      <div class="pill-open"><span class="dot"></span><span>Caja abierta</span></div>
      <div class="user-card">
        <div class="avatar a38" style="--c:${roleColor}">${mono(state.userName)}</div>
        <div class="user-info">
          <div class="user-name">${esc(state.userName)}</div>
          <div class="user-role" style="color:${roleColor}">${isDueno ? 'Dueño' : 'Cajero'}</div>
        </div>
        <button class="icon-btn" data-action="logout" title="Cerrar sesión">${I.logout()}</button>
      </div>
    </div>
  </aside>`;
}

/* ----- POS ----- */
function renderPos() {
  return `<div class="pos">${renderCatalog()}${renderCart()}</div>`;
}

function renderCatalog() {
  const chips = ['Todo', ...Object.keys(CATS)].map(name => {
    const cc = name === 'Todo' ? { c: '#D9531B', s: '#FCEBDE' } : catOf(name);
    return `<button class="chip${state.cat === name ? ' active' : ''}" style="--c:${cc.c};--s:${cc.s}" data-action="set-cat" data-arg="${name}">${name}</button>`;
  }).join('');

  const cards = visibleProducts().map(p => {
    const cc = catOf(p.cat);
    return `
    <button class="prod-card" style="--c:${cc.c};--s:${cc.s}" data-action="add-product" data-arg="${p.id}">
      <div class="prod-top">
        ${avatarHtml(p, 'a40')}
        ${p.unit === 'kg' ? '<span class="badge-granel">Granel</span>' : ''}
      </div>
      <div class="prod-name">${esc(p.name)}</div>
      <div class="prod-bottom">
        <span class="prod-price">${m(p.price)}</span>
        <span class="prod-unit">${p.unit === 'kg' ? '/ kg' : 'c/u'}</span>
      </div>
    </button>`;
  }).join('');

  return `
  <section class="catalog">
    <div class="catalog-head">
      <div class="catalog-title">
        <h1>Nueva venta</h1>
        <div class="hint">Toca un producto para agregarlo al ticket</div>
      </div>
      <div class="search">
        ${I.search()}
        <input data-input="query" data-key="query" value="${esc(state.query)}" placeholder="Buscar o escanear código…">
      </div>
    </div>
    <div class="chips">${chips}</div>
    <div class="grid-wrap" data-scroll="catalog">
      <div class="prod-grid">${cards}</div>
      ${cards ? '' : '<div class="no-results">Sin resultados para tu búsqueda.</div>'}
    </div>
  </section>`;
}

function renderCart() {
  const lines = buildLines();
  const total = cartTotal();
  const hasCart = lines.length > 0;
  const count = lines.reduce((a, l) => a + (l.isKg ? 1 : l.qty), 0);
  const tend = parseNum(state.tendered);
  const showChange = hasCart && tend && tend >= total;

  const lineHtml = lines.map(l => {
    const qtyCtl = l.isKg
      ? `<span class="kg-pill">${l.weight.toFixed(3)} kg</span>`
      : `<span class="stepper">
           <button class="step-btn" data-action="qty-dec" data-arg="${l.idx}">−</button>
           <span class="step-qty">${l.qty}</span>
           <button class="step-btn" data-action="qty-inc" data-arg="${l.idx}">+</button>
         </span>`;
    return `
    <div class="cart-line">
      ${avatarHtml(l.p, 'a38')}
      <div class="cl-info">
        <div class="cl-name">${esc(l.p.name)}</div>
        <div class="cl-unit">${m(l.p.price)}${l.isKg ? ' / kg' : ' c/u'}</div>
        <div class="cl-qty">${qtyCtl}</div>
      </div>
      <div class="cl-right">
        <span class="cl-total">${m(l.lineTotal)}</span>
        <button class="x-btn" data-action="remove-line" data-arg="${l.idx}" title="Quitar">${I.x()}</button>
      </div>
    </div>`;
  }).join('');

  const empty = `
    <div class="cart-empty">
      <div class="empty-circle">${I.cart(34, 1.9, '#D9AE7E')}</div>
      <div class="empty-title">El ticket está vacío</div>
      <div class="empty-sub">Agrega productos desde el catálogo para empezar a cobrar.</div>
    </div>`;

  const quick = [100, 200, 500].map(v =>
    `<button class="quick-btn" data-action="quick-cash" data-arg="${v}">$${v}</button>`
  ).join('') + `<button class="quick-btn" data-action="quick-cash" data-arg="exact">Exacto</button>`;

  return `
  <aside class="cart">
    <div class="cart-head">
      <div class="cart-title"><h2>Ticket</h2><span class="count-badge">${count}</span></div>
      ${hasCart ? `<button class="link-clear" data-action="clear-cart">${I.trash()}Vaciar</button>` : ''}
    </div>
    <div class="cart-list" data-scroll="cart">${hasCart ? lineHtml : empty}</div>
    <div class="payment">
      <div class="pay-total"><span>Total a cobrar</span><span class="pay-amount">${m(total)}</span></div>
      <div class="cash-row">
        <span class="cash-label">Efectivo</span>
        <div class="money-input">
          <span class="currency">$</span>
          <input data-input="tendered" data-key="tendered" inputmode="decimal" placeholder="0.00" value="${esc(state.tendered)}">
        </div>
      </div>
      <div class="quick-row">${quick}</div>
      ${showChange ? `<div class="change-box"><span>Cambio</span><span class="change-amt">${m(tend - total)}</span></div>` : ''}
      <button class="charge-btn${hasCart ? '' : ' off'}" data-action="charge">Cobrar ${m(total)}</button>
    </div>
  </aside>`;
}

/* ----- Inventario ----- */
function renderInventory() {
  const thr = CONFIG.lowStockThreshold;
  const isDueno = state.role === 'dueno';
  const iq = state.invQuery.trim().toLowerCase();

  const cls = isDueno ? ' inv-row' : '';
  const rows = state.products
    .filter(p => !iq || p.name.toLowerCase().includes(iq) || p.barcode.includes(iq) || p.cat.toLowerCase().includes(iq))
    .map(p => {
      const cc = catOf(p.cat);
      const st = p.stock <= 0 ? { l: 'Agotado', cls: 'st-out' }
               : p.stock <= thr ? { l: 'Bajo', cls: 'st-low' }
               : { l: 'En stock', cls: 'st-ok' };
      const rowActions = isDueno ? `
        <div class="row-actions">
          <button class="mini-btn" data-action="ep-open" data-arg="${p.id}" title="Editar producto">${I.pencil()}</button>
          <button class="mini-btn danger" data-action="dp-ask" data-arg="${p.id}" title="Borrar producto">${I.trash()}</button>
        </div>` : '';
      return `
      <div class="t-row${cls}${p.id === state.flashId ? ' flash' : ''}">
        <div class="t-prod">
          ${avatarHtml(p, 'a34')}
          <div class="t-prod-txt">
            <div class="t-name">${esc(p.name)}</div>
            <div class="t-sub">${p.unit === 'kg' ? 'Venta a granel' : 'Por pieza'}</div>
          </div>
        </div>
        <span class="cat-pill" style="--c:${cc.c};--s:${cc.s}">${p.cat}</span>
        <span class="t-code">${esc(p.barcode)}</span>
        <span class="t-price">${m(p.price)}</span>
        <div class="t-stock">
          <span class="t-stock-n">${fmtQty(p.stock)} ${p.unit === 'kg' ? 'kg' : 'pz'}</span>
          <span class="status ${st.cls}">${st.l}</span>
        </div>
        ${rowActions}
      </div>`;
    }).join('');

  const statLow = state.products.filter(p => p.stock > 0 && p.stock <= thr).length;
  const statOut = state.products.filter(p => p.stock <= 0).length;

  return `
  <div class="page" data-scroll="inv">
    <div class="page-inner">
      <div class="page-head">
        <div class="page-title">
          <h1>Inventario</h1>
          <div class="hint">${state.products.length} productos · el stock se descuenta solo al cobrar</div>
        </div>
        <div class="search sm">
          ${I.search()}
          <input data-input="invQuery" data-key="invQuery" value="${esc(state.invQuery)}" placeholder="Buscar producto o código…">
        </div>
        ${isDueno ? `<button class="btn-primary" data-action="np-open">${I.plus()}Nuevo producto</button>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><div class="stat-label">Productos</div><div class="stat-val">${state.products.length}</div></div>
        <div class="stat warn"><div class="stat-label">Stock bajo</div><div class="stat-val">${statLow}</div></div>
        <div class="stat danger"><div class="stat-label">Agotados</div><div class="stat-val">${statOut}</div></div>
      </div>
      <div class="table">
        <div class="t-head${cls}"><span>Producto</span><span>Categoría</span><span>Código de barras</span><span class="right">Precio</span><span class="right">Stock</span>${isDueno ? '<span class="right">Acciones</span>' : ''}</div>
        ${rows || '<div class="t-empty">Sin productos que coincidan.</div>'}
      </div>
      ${state.dataPath ? `<div class="data-note">Datos guardados en: ${esc(state.dataPath)}</div>` : ''}
    </div>
  </div>`;
}

/* ----- Ventas del día ----- */
function renderSales() {
  const stats = todayStats();
  const canceled = state.sales.filter(s => s.status === 'cancelada').length;

  const rows = [...state.sales].reverse().map(s => {
    const items = s.lines.map(l => `${qtyLabel(l)} ${l.name}`).join(' · ');
    const action = s.status === 'ok'
      ? `<button class="btn-revert" data-action="revert-ask" data-arg="${s.folio}">${I.undo()}Revertir</button>`
      : `<span class="status st-out">Revertida</span>`;
    return `
    <div class="t-row sales-row${s.status === 'cancelada' ? ' canceled' : ''}">
      <span class="t-code">${s.folio}</span>
      <span class="s-time">${saleTime(s)}</span>
      <div class="s-items" title="${esc(items)}">${esc(items)}</div>
      <span class="s-user">${esc(s.vendedor || '')}</span>
      <span class="t-price">${m(s.total)}</span>
      <div class="s-action">${action}</div>
    </div>`;
  }).join('');

  return `
  <div class="page" data-scroll="sales">
    <div class="page-inner">
      <div class="page-head">
        <div class="page-title">
          <h1>Ventas de hoy</h1>
          <div class="hint">${todayStr()} · al revertir una venta el stock regresa al inventario</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat-label">Tickets cobrados</div><div class="stat-val">${stats.count}</div></div>
        <div class="stat"><div class="stat-label">Total vendido</div><div class="stat-val">${m(stats.total)}</div></div>
        <div class="stat danger"><div class="stat-label">Revertidas</div><div class="stat-val">${canceled}</div></div>
      </div>
      <div class="table">
        <div class="t-head sales-row"><span>Folio</span><span>Hora</span><span>Artículos</span><span>Cobró</span><span class="right">Total</span><span class="right">Acción</span></div>
        ${rows || '<div class="t-empty">Aún no hay ventas hoy. Los tickets cobrados aparecen aquí.</div>'}
      </div>
    </div>
  </div>`;
}

/* ----- Panel del dueño ----- */
function renderDashboard() {
  const thr = CONFIG.lowStockThreshold;
  const stats = todayStats();
  const ventas = stats.total;
  const tickets = stats.count;
  const esperado = CONFIG.cashFund + ventas;
  const statLow = state.products.filter(p => p.stock > 0 && p.stock <= thr).length;

  // comparación real contra ayer
  const keys = lastDays(7);
  const yes = state.week[keys[5]];
  let vsAyer = 'Sin ventas registradas ayer';
  if (yes && yes.total > 0) {
    const pct = Math.round((ventas - yes.total) / yes.total * 100);
    vsAyer = (pct >= 0 ? '▲ +' : '▼ ') + pct + '% vs. ayer';
  }

  // gráfica: últimos 7 días terminando hoy (datos reales)
  const week = keys.map(k => {
    const d = new Date(k + 'T12:00:00');
    const label = d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
    const isToday = k === todayKey();
    const v = isToday ? ventas : (state.week[k] ? state.week[k].total : 0);
    return { d: label.charAt(0).toUpperCase() + label.slice(1), v, t: isToday };
  });
  const maxV = Math.max(...week.map(w => w.v), 1);
  const bars = week.map(w => `
    <div class="bar-col${w.t ? ' today' : ''}">
      <span class="bar-amt">${w.v > 0 ? '$' + (w.v >= 1000 ? (w.v / 1000).toFixed(1) + 'k' : Math.round(w.v)) : '—'}</span>
      <div class="bar" style="height:${Math.max(6, Math.round(w.v / maxV * 130))}px"></div>
      <span class="bar-day">${w.d}</span>
    </div>`).join('');

  const contado = parseNum(state.contado);
  let dif = { label: 'Diferencia', str: '—', cls: '' };
  if (!isNaN(contado)) {
    const d = contado - esperado;
    const s = (d >= 0 ? '+' : '-') + m(Math.abs(d));
    if (Math.abs(d) < 0.01) dif = { label: 'Caja cuadrada', str: s, cls: ' ok' };
    else if (d > 0)         dif = { label: 'Sobrante',      str: s, cls: ' over' };
    else                    dif = { label: 'Faltante',      str: s, cls: ' short' };
  }

  // productos más vendidos hoy (datos reales)
  const agg = {};
  state.sales.filter(s => s.status === 'ok').forEach(s => s.lines.forEach(l => {
    if (!agg[l.id]) agg[l.id] = { id: l.id, name: l.name, unit: l.unit, q: 0, rev: 0 };
    agg[l.id].q = round3(agg[l.id].q + l.q);
    agg[l.id].rev = round2(agg[l.id].rev + l.lineTotal);
  }));
  const top = Object.values(agg).sort((a, b) => b.rev - a.rev).slice(0, 5);
  const maxRev = Math.max(...top.map(t => t.rev), 1);
  const tops = top.map((t, i) => {
    const p = findProduct(t.id);
    const cc = catOf(p ? p.cat : '');
    return `
    <div class="top-row">
      <span class="top-rank">#${i + 1}</span>
      ${avatarHtml(p || { name: t.name, cat: '' }, 'a34')}
      <div class="top-mid">
        <div class="top-name">${esc(t.name)}</div>
        <div class="top-track"><div class="top-fill" style="--c:${cc.c};width:${Math.round(t.rev / maxRev * 100)}%"></div></div>
      </div>
      <div class="top-right">
        <div class="top-rev">${m(t.rev)}</div>
        <div class="top-units">${fmtQty(t.q)} ${t.unit === 'kg' ? 'kg' : 'pz'}</div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="page" data-scroll="dash">
    <div class="page-inner">
      <div class="page-head-simple">
        <h1>Panel del dueño</h1>
        <div class="hint">Resumen de hoy · ${todayStr()}</div>
      </div>
      <div class="kpis">
        <div class="kpi hero">
          <div class="kpi-label">Ventas de hoy</div>
          <div class="kpi-val">${m(ventas)}</div>
          <div class="kpi-sub">${vsAyer}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Tickets</div>
          <div class="kpi-val">${tickets}</div>
          <div class="kpi-sub">Promedio ${m(tickets ? ventas / tickets : 0)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Efectivo en caja</div>
          <div class="kpi-val">${m(esperado)}</div>
          <div class="kpi-sub">Fondo ${m(CONFIG.cashFund)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Stock bajo</div>
          <div class="kpi-val warn">${statLow}</div>
          <div class="kpi-sub">Requieren resurtido</div>
        </div>
      </div>
      <div class="dash-grid">
        <div class="card">
          <div class="card-head"><h3>Ventas de la semana</h3><span class="card-note">Últimos 7 días</span></div>
          <div class="bars">${bars}</div>
        </div>
        <div class="card">
          <div class="card-head-icon">
            <div class="mini-icon">${I.wallet()}</div>
            <h3>Corte de caja</h3>
          </div>
          <div class="corte">
            <div class="corte-row">Fondo inicial <span>${m(CONFIG.cashFund)}</span></div>
            <div class="corte-row">Ventas en efectivo <span>${m(ventas)}</span></div>
            <div class="corte-total">Esperado en caja <span>${m(esperado)}</span></div>
          </div>
          <div class="contado">
            <div class="field-label">Efectivo contado</div>
            <div class="money-input block">
              <span class="currency">$</span>
              <input data-input="contado" data-key="contado" inputmode="decimal" placeholder="0.00" value="${esc(state.contado)}">
            </div>
            <div class="dif-box${dif.cls}"><span>${dif.label}</span><span class="dif-amt">${dif.str}</span></div>
          </div>
        </div>
        <div class="card top-card">
          <h3>Productos más vendidos hoy</h3>
          ${tops || '<div class="t-empty">Todavía no hay ventas hoy.</div>'}
        </div>
      </div>
    </div>
  </div>`;
}

/* ----- Modal: peso (granel) ----- */
function renderWeightModal() {
  if (!state.weightId) return '';
  const p = findProduct(state.weightId);
  const w = parseNum(state.weightVal) || 0;
  const presets = [0.25, 0.5, 1, 2].map(v =>
    `<button class="preset" data-action="weight-preset" data-arg="${v}">${v} kg</button>`).join('');
  return `
  <div class="overlay" data-action="overlay-close" data-arg="weight">
    <div class="modal">
      <div class="modal-head">
        ${avatarHtml(p, 'a48')}
        <div>
          <div class="modal-title">${esc(p.name)}</div>
          <div class="modal-sub">${m(p.price)} / kg · venta a granel</div>
        </div>
      </div>
      <div class="w-box">
        <div class="field-label center">Peso</div>
        <div class="w-input-row">
          <input data-input="weightVal" data-key="weightVal" inputmode="decimal" value="${esc(state.weightVal)}">
          <span class="w-unit">kg</span>
        </div>
        <div class="w-subtotal">= ${m(p.price * w)}</div>
      </div>
      <div class="presets">${presets}</div>
      <div class="modal-actions">
        <button class="btn-ghost" data-action="weight-cancel">Cancelar</button>
        <button class="btn-teal" data-action="weight-confirm">Agregar al ticket</button>
      </div>
    </div>
  </div>`;
}

/* ----- Modal: ticket cobrado ----- */
function renderTicketModal() {
  const tk = state.ticket;
  if (!tk) return '';
  const lines = tk.lines.map(l => `
    <div class="r-line">
      <div class="r-line-l">
        <div class="r-name">${esc(l.name)}</div>
        <div class="r-sub">${qtyLabel(l)} · ${unitStr(l)}</div>
      </div>
      <div class="r-amt">${m(l.lineTotal)}</div>
    </div>`).join('');
  return `
  <div class="overlay" data-action="overlay-close" data-arg="ticket">
    <div class="modal ticket-modal">
      <div class="receipt-wrap">
        <div class="receipt">
          <div class="r-head">
            <div class="logo logo-r">${I.paw(22)}</div>
            <div class="r-brand">${esc(CONFIG.brandName)}</div>
            <div class="r-addr">Av. de las Mascotas 24, Local 3<br>Tel. 55 8842 1190</div>
          </div>
          <div class="r-meta"><span>${tk.folio}</span><span>${tk.dateLabel}</span></div>
          <div class="r-lines">${lines}</div>
          <div class="r-total"><span>Total</span><span class="r-total-amt">${m(tk.total)}</span></div>
          <div class="r-cash"><span>Efectivo</span><span>${m(tk.tend)}</span></div>
          <div class="r-cash"><span>Cambio</span><span>${m(tk.change)}</span></div>
          <div class="r-thanks">¡Gracias por consentir a tu mascota! 🐾</div>
        </div>
      </div>
      <div class="ticket-actions">
        <div class="check-circle">${I.check()}</div>
        <h2>Venta cobrada</h2>
        <div class="ta-sub">Ticket <b>${tk.folio}</b> generado. El stock ya se descontó del inventario.</div>
        <div class="send-box">
          <div class="field-label">Enviar ticket al cliente</div>
          <div class="phone-input">
            ${I.phone()}
            <input data-input="phone" data-key="phone" inputmode="tel" placeholder="Número de WhatsApp" value="${esc(state.phone)}">
          </div>
          <button class="btn-wa${state.waSent ? ' sent' : ''}" data-action="send-whatsapp">${I.wa()}${state.waSent ? 'Reenviar por WhatsApp' : 'Enviar por WhatsApp'}</button>
          ${state.waSent ? '<div class="wa-note">✓ WhatsApp Web abierto con el ticket adjunto</div>' : ''}
        </div>
        <button class="btn-outline" data-action="download-pdf">${I.download()}Descargar PDF</button>
        <button class="link-new" data-action="ticket-close">Nueva venta →</button>
      </div>
    </div>
  </div>`;
}

/* ----- Modal: nuevo producto ----- */
function renderNewProductModal() {
  if (!state.showNewProduct) return '';
  const f = state.np;
  const editing = !!state.editId;
  const valid = f.name.trim() && parseNum(f.price) > 0;
  const catOpts = Object.keys(CATS).map(c =>
    `<option value="${c}"${f.cat === c ? ' selected' : ''}>${c}</option>`).join('');
  return `
  <div class="overlay" data-action="overlay-close" data-arg="np">
    <div class="modal np-modal">
      <h2 class="np-title">${editing ? 'Editar producto' : 'Nuevo producto'}</h2>
      <div class="field">
        <label>Nombre</label>
        <input data-input="np.name" data-key="np_name" value="${esc(f.name)}" placeholder="Ej. Croqueta Cachorro 4kg">
      </div>
      <div class="field-grid">
        <div class="field">
          <label>Categoría</label>
          <select data-input="np.cat" data-key="np_cat">${catOpts}</select>
        </div>
        <div class="field">
          <label>Unidad</label>
          <select data-input="np.unit" data-key="np_unit">
            <option value="pza"${f.unit === 'pza' ? ' selected' : ''}>Pieza</option>
            <option value="kg"${f.unit === 'kg' ? ' selected' : ''}>Granel (kg)</option>
          </select>
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label>Precio ${f.unit === 'kg' ? '(por kg)' : '(por pieza)'}</label>
          <input data-input="np.price" data-key="np_price" inputmode="decimal" value="${esc(f.price)}" placeholder="0.00">
        </div>
        <div class="field">
          <label>Stock inicial</label>
          <input data-input="np.stock" data-key="np_stock" inputmode="decimal" value="${esc(f.stock)}" placeholder="0">
        </div>
      </div>
      <div class="field">
        <label>Código de barras <span class="opt">(opcional)</span></label>
        <input data-input="np.barcode" data-key="np_barcode" inputmode="numeric" value="${esc(f.barcode)}" placeholder="Se genera automáticamente">
      </div>
      <div class="field">
        <label>Imagen <span class="opt">(opcional)</span></label>
        <div class="img-pick">
          ${f.img
            ? `<div class="avatar a48 has-img"><img src="${f.img}" alt=""></div>`
            : `<div class="avatar a48" style="--c:${catOf(f.cat).c}">${mono(f.name || '?')}</div>`}
          <label class="btn-min">${f.img ? 'Cambiar imagen' : 'Elegir imagen…'}<input type="file" accept="image/*" data-file="np-img" hidden></label>
          ${f.img ? `<button class="btn-min danger" data-action="np-img-clear">Quitar</button>` : ''}
        </div>
      </div>
      ${state.npError ? `<div class="form-error">${esc(state.npError)}</div>` : ''}
      <div class="modal-actions">
        <button class="btn-ghost" data-action="np-cancel">Cancelar</button>
        <button class="btn-save${valid ? '' : ' off'}" data-action="np-save">${editing ? 'Guardar cambios' : 'Guardar producto'}</button>
      </div>
    </div>
  </div>`;
}

/* ----- Modal: confirmar borrado de producto ----- */
function renderDeleteModal() {
  if (!state.confirmDelete) return '';
  const p = findProduct(state.confirmDelete);
  if (!p) return '';
  return `
  <div class="overlay" data-action="overlay-close" data-arg="dp">
    <div class="modal">
      <h2 class="np-title">Borrar producto</h2>
      <div class="modal-head">
        ${avatarHtml(p, 'a48')}
        <div>
          <div class="modal-title">${esc(p.name)}</div>
          <div class="modal-sub">${m(p.price)}${p.unit === 'kg' ? ' / kg' : ' c/u'} · stock ${fmtQty(p.stock)} ${p.unit === 'kg' ? 'kg' : 'pz'}</div>
        </div>
      </div>
      <div class="rv-warn">El producto desaparecerá del catálogo y del inventario. Las ventas ya cobradas no se modifican. Esta acción no se puede deshacer.</div>
      <div class="modal-actions">
        <button class="btn-ghost" data-action="dp-cancel">Conservar</button>
        <button class="btn-danger" data-action="dp-confirm">${I.trash()}Sí, borrar</button>
      </div>
    </div>
  </div>`;
}

/* ----- Modal: confirmar reversión ----- */
function renderRevertModal() {
  if (!state.confirmRevert) return '';
  const s = state.sales.find(x => x.folio === state.confirmRevert);
  if (!s) return '';
  const items = s.lines.map(l => `
    <div class="rv-line"><span>${qtyLabel(l)} · ${esc(l.name)}</span><span>${m(l.lineTotal)}</span></div>`).join('');
  return `
  <div class="overlay" data-action="overlay-close" data-arg="revert">
    <div class="modal">
      <h2 class="np-title">Revertir venta</h2>
      <div class="rv-sub">Ticket <b>${s.folio}</b> · ${saleTime(s)} · ${m(s.total)}</div>
      <div class="rv-box">${items}</div>
      <div class="rv-warn">El stock de estos productos regresará al inventario y la venta se descontará del corte del día. Esta acción no se puede deshacer.</div>
      <div class="modal-actions">
        <button class="btn-ghost" data-action="revert-cancel">Conservar venta</button>
        <button class="btn-danger" data-action="revert-confirm">${I.undo()}Sí, revertir</button>
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------- acciones */
function addProduct(id) {
  const p = findProduct(id);
  if (!p) return;
  if (p.unit === 'kg') {
    state.weightId = id;
    state.weightVal = '0.500';
    state._focus = 'weightVal';
    return;
  }
  const i = state.cart.findIndex(c => c.id === id && c.qty != null);
  if (i >= 0) state.cart[i].qty += 1;
  else state.cart.push({ id, qty: 1 });
}

function changeQty(idx, d) {
  const it = state.cart[idx];
  if (!it) return;
  const n = (it.qty || 1) + d;
  if (n <= 0) state.cart.splice(idx, 1);
  else it.qty = n;
}

function charge() {
  const lines = buildLines();
  if (!lines.length) return;
  ensureToday();
  const total = round2(cartTotal());
  const tend = parseNum(state.tendered) || total; // sin monto capturado = pago exacto
  const change = Math.max(0, round2(tend - total));
  const now = new Date();

  // el stock se descuenta al cobrar
  lines.forEach(l => { l.p.stock = Math.max(0, round3(l.p.stock - l.q)); });

  const sale = {
    folio: 'MSC-' + String(state.folioSeq).padStart(6, '0'),
    iso: now.toISOString(),
    dateKey: todayKey(),
    vendedor: state.userName,
    lines: lines.map(l => ({
      id: l.p.id,
      name: l.p.name,
      unit: l.isKg ? 'kg' : 'pza',
      q: l.q,
      price: l.p.price,
      lineTotal: round2(l.lineTotal),
    })),
    total, tend, change,
    status: 'ok',
  };
  state.sales.push(sale);
  state.folioSeq += 1;

  state.ticket = {
    ...sale,
    dateLabel: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
             + ' · ' + now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  };
  state.cart = [];
  state.tendered = '';
  state.phone = '';
  state.waSent = false;

  persistSales();
  persistProducts();
  persistMeta();
}

function revertSale(folio) {
  const s = state.sales.find(x => x.folio === folio && x.status === 'ok');
  if (!s) return;
  s.status = 'cancelada';
  s.canceladaISO = new Date().toISOString();
  // el stock regresa al inventario
  s.lines.forEach(l => {
    const p = findProduct(l.id);
    if (p) p.stock = round3(p.stock + l.q);
  });
  persistSales();
  persistProducts();
}

function closeTicket() {
  state.ticket = null;
  state.waSent = false;
}

function sendWhatsApp() {
  const tk = state.ticket;
  if (!tk) return;
  const rows = tk.lines.map(l => `${qtyLabel(l)} · ${l.name} — ${m(l.lineTotal)}`).join('\n');
  const text = [
    `🐾 *${CONFIG.brandName}* · Ticket ${tk.folio}`,
    tk.dateLabel,
    '——————————————',
    rows,
    '——————————————',
    `Total: ${m(tk.total)}`,
    `Efectivo: ${m(tk.tend)}`,
    `Cambio: ${m(tk.change)}`,
    '¡Gracias por consentir a tu mascota! 🐾',
  ].join('\n');
  let digits = state.phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '52' + digits; // 10 dígitos MX → lada internacional
  const url = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
  state.waSent = true;
}

function saveNewProduct() {
  const f = state.np;
  const name = f.name.trim();
  const price = parseNum(f.price);
  if (!name) { state.npError = 'Escribe el nombre del producto.'; state._focus = 'np_name'; return; }
  if (!(price > 0)) { state.npError = 'El precio debe ser un número mayor a cero (ej. 45.50).'; state._focus = 'np_price'; return; }
  const stock = Math.max(0, parseNum(f.stock) || 0);
  let barcode = f.barcode.replace(/\D/g, '');
  if (barcode && state.products.some(p => p.barcode === barcode && p.id !== state.editId)) {
    state.npError = 'Ya existe un producto con ese código de barras.';
    state._focus = 'np_barcode';
    return;
  }
  if (!barcode) barcode = '7501' + String(Math.floor(1e7 + Math.random() * 9e7));
  const datos = {
    name,
    cat: CATS[f.cat] ? f.cat : 'Alimento',
    price: round2(price),
    unit: f.unit === 'kg' ? 'kg' : 'pza',
    stock: f.unit === 'kg' ? round3(stock) : Math.round(stock),
    barcode,
    img: f.img || '',
  };
  let id;
  if (state.editId) {
    const p = findProduct(state.editId);
    if (!p) { state.npError = 'El producto ya no existe.'; return; }
    Object.assign(p, datos);
    id = p.id;
  } else {
    id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e3);
    state.products.push({ id, ...datos });
  }
  state.showNewProduct = false;
  state.editId = null;
  state.np = emptyNp();
  state.npError = '';
  state.flashId = id;
  state.invQuery = '';
  persistProducts();
}

function deleteProduct(id) {
  const i = state.products.findIndex(p => p.id === id);
  if (i < 0) return;
  state.products.splice(i, 1);
  state.cart = state.cart.filter(c => c.id !== id); // fuera del ticket en curso
  if (state.weightId === id) state.weightId = null;
  persistProducts();
  if (SB && SB.hasSession()) {
    SB.deleteProduct(id).catch(() => {
      state.syncMsg = 'Sin conexión con Supabase — el borrado quedó guardado localmente.';
      render();
    });
  }
}

function doLoginSupabase() {
  const f = state.login;
  if (f.busy) return;
  if (!f.email.trim() || !f.password) { f.error = 'Escribe tu correo y contraseña.'; return; }
  f.busy = true;
  f.error = '';
  SB.login(f.email.trim(), f.password)
    .then(async perfil => {
      state.role = perfil.rol;
      state.userName = perfil.nombre;
      state.screen = 'pos';
      f.busy = false;
      f.password = '';
      try {
        const remote = await SB.fetchProducts();
        if (remote.length) {
          state.products = remote;
          Promise.resolve(Store.saveProducts(state.products)).catch(() => {});
        } else {
          // primera vez: sube el catálogo local a Supabase
          await SB.upsertProducts(state.products);
        }
        state.syncMsg = '';
      } catch (_) {
        state.syncMsg = 'Sin conexión con Supabase — usando el catálogo local.';
      }
      render();
    })
    .catch(err => {
      f.busy = false;
      f.error = err.message || 'No se pudo iniciar sesión.';
      render();
    });
}

const actions = {
  'login-dueno':  () => { state.role = 'dueno';  state.userName = 'Aarón';       state.screen = 'pos'; },
  'login-cajero': () => { state.role = 'cajero'; state.userName = 'Mostrador 1'; state.screen = 'pos'; },
  'login-sb':     () => doLoginSupabase(),
  'logout':       () => {
    state.screen = 'login'; state.cart = []; state.tendered = '';
    state.login = { email: '', password: '', error: '', busy: false };
    if (SB) SB.logout();
  },
  'nav': arg => {
    if (arg === 'dashboard' && state.role !== 'dueno') return;
    state.screen = arg;
  },
  'set-cat':     arg => { state.cat = arg; },
  'add-product': arg => addProduct(arg),
  'qty-inc':     arg => changeQty(+arg, 1),
  'qty-dec':     arg => changeQty(+arg, -1),
  'remove-line': arg => { state.cart.splice(+arg, 1); },
  'clear-cart':  () => { state.cart = []; state.tendered = ''; },
  'quick-cash':  arg => { state.tendered = arg === 'exact' ? cartTotal().toFixed(2) : String(arg); },
  'charge':      () => charge(),
  'weight-preset': arg => { state.weightVal = Number(arg).toFixed(3); state._focus = 'weightVal'; },
  'weight-cancel': () => { state.weightId = null; },
  'weight-confirm': () => {
    const w = parseNum(state.weightVal);
    if (w > 0) state.cart.push({ id: state.weightId, weight: round3(w) });
    state.weightId = null;
  },
  'overlay-close': (arg, e, el) => {
    // Los clics dentro del modal (inputs, selects) burbujean hasta aquí:
    // devolver false evita el re-render, que cerraría el dropdown nativo
    // del select y reiniciaría la animación del modal.
    if (e && e.target !== el) return false; // solo clic directo en el fondo
    if (arg === 'weight') state.weightId = null;
    else if (arg === 'ticket') closeTicket();
    else if (arg === 'np') { state.showNewProduct = false; state.editId = null; state.npError = ''; }
    else if (arg === 'revert') state.confirmRevert = null;
    else if (arg === 'dp') state.confirmDelete = null;
  },
  'ticket-close':  () => closeTicket(),
  'send-whatsapp': () => sendWhatsApp(),
  'download-pdf':  () => { window.print(); },
  'np-open':   () => { state.showNewProduct = true; state.editId = null; state.np = emptyNp(); state.npError = ''; state._focus = 'np_name'; },
  'np-cancel': () => { state.showNewProduct = false; state.editId = null; state.npError = ''; },
  'np-save':   () => saveNewProduct(),
  'ep-open': arg => {
    const p = findProduct(arg);
    if (!p || state.role !== 'dueno') return;
    state.editId = p.id;
    state.np = { name: p.name, cat: p.cat, price: String(p.price), unit: p.unit, barcode: p.barcode, stock: String(p.stock), img: p.img || '' };
    state.npError = '';
    state.showNewProduct = true;
    state._focus = 'np_name';
  },
  'np-img-clear': () => { state.np.img = ''; },
  'dp-ask':     arg => { if (state.role === 'dueno') state.confirmDelete = arg; },
  'dp-cancel':  () => { state.confirmDelete = null; },
  'dp-confirm': () => { deleteProduct(state.confirmDelete); state.confirmDelete = null; },
  'revert-ask':     arg => { state.confirmRevert = arg; },
  'revert-cancel':  () => { state.confirmRevert = null; },
  'revert-confirm': () => { revertSale(state.confirmRevert); state.confirmRevert = null; },
};

function setField(field, value) {
  if (field.startsWith('np.')) { state.np[field.slice(3)] = value; state.npError = ''; }
  else if (field.startsWith('login.')) { state.login[field.slice(6)] = value; state.login.error = ''; }
  else state[field] = value;
}

/* ---------------------------------------------------------- render */
function render() {
  const app = document.getElementById('app');

  // conserva foco/caret y scroll entre renders
  const focused = document.activeElement;
  const key = focused && focused.dataset ? focused.dataset.key : null;
  let selStart = null, selEnd = null;
  if (key && typeof focused.selectionStart === 'number') {
    selStart = focused.selectionStart;
    selEnd = focused.selectionEnd;
  }
  const scrolls = {};
  app.querySelectorAll('[data-scroll]').forEach(el => { scrolls[el.dataset.scroll] = el.scrollTop; });

  // qué elementos animados ya estaban en pantalla: al recrearlos no deben
  // repetir su animación de entrada (parpadeo al escribir)
  const hadOverlay = !!app.querySelector('.overlay');
  const hadLogin = !!app.querySelector('.login-box');

  app.innerHTML = html();

  if (hadOverlay) app.querySelectorAll('.overlay, .modal').forEach(el => el.classList.add('no-anim'));
  if (hadLogin) {
    const lb = app.querySelector('.login-box');
    if (lb) lb.classList.add('no-anim');
  }

  Object.keys(scrolls).forEach(k => {
    const el = app.querySelector(`[data-scroll="${k}"]`);
    if (el) el.scrollTop = scrolls[k];
  });

  if (state._focus) {
    const el = app.querySelector(`[data-key="${state._focus}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      if (typeof el.select === 'function') el.select();
    }
    state._focus = null;
  } else if (key) {
    const el = app.querySelector(`[data-key="${key}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      if (selStart != null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(selStart, selEnd); } catch (_) { /* tipos sin selección */ }
      }
    }
  }
}

function update() { ensureToday(); render(); }

/* ---------------------------------------------------------- eventos */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (fn(el.dataset.arg, e, el) === false) return; // acción sin cambios: no re-render
  update();
});

function onField(e) {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  setField(el.dataset.input, el.value);
  update();
}
document.addEventListener('input', onField);
document.addEventListener('change', e => {
  if (e.target.tagName === 'SELECT') { onField(e); return; }
  if (e.target.dataset && e.target.dataset.file === 'np-img') pickImage(e.target);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.weightId) { state.weightId = null; update(); }
    else if (state.confirmRevert) { state.confirmRevert = null; update(); }
    else if (state.confirmDelete) { state.confirmDelete = null; update(); }
    else if (state.showNewProduct) { state.showNewProduct = false; state.editId = null; state.npError = ''; update(); }
    else if (state.ticket) { closeTicket(); update(); }
    return;
  }
  if (e.key !== 'Enter') return;
  const input = e.target && e.target.dataset ? e.target.dataset.input : null;
  if (input === 'weightVal') {
    actions['weight-confirm']();
    update();
  } else if (input === 'tendered') {
    charge();
    update();
  } else if (input && input.startsWith('np.')) {
    saveNewProduct();
    update();
  } else if (input && input.startsWith('login.')) {
    doLoginSupabase();
    update();
  } else if (input === 'query') {
    // lector de código de barras: dígitos + Enter agrega el producto
    const q = state.query.trim().toLowerCase();
    if (!q) return;
    const list = visibleProducts();
    const pick = state.products.find(p => p.barcode === q) || (list.length === 1 ? list[0] : null);
    if (!pick) return;
    state.query = '';
    addProduct(pick.id);
    update();
  }
});

/* ---------------------------------------------------------- arranque */
async function init() {
  // Supabase: en escritorio la config vive en supabase.json (carpeta de
  // datos); en navegador, en supabase-config.js.
  let sbConfig = window.SUPABASE_CONFIG || null;
  if (FS && FS.getSupabaseConfig) {
    try {
      const fromFile = await FS.getSupabaseConfig();
      if (fromFile && fromFile.url && fromFile.anonKey) sbConfig = fromFile;
    } catch (_) { /* sin config en archivo */ }
  }
  if (!SMOKE) SB = makeSupabase(sbConfig);

  if (PERSIST && !SMOKE) {
    try {
      const [products, meta, sales, week] = await Promise.all([
        Store.loadProducts(),
        Store.loadMeta(),
        Store.loadSales(todayKey()),
        Store.loadWeek(lastDays(7).slice(0, 6)),
      ]);
      if (Array.isArray(products) && products.length) state.products = products;
      else Promise.resolve(Store.saveProducts(state.products)).catch(() => {}); // primer arranque: se crea el archivo
      if (meta && typeof meta.folioSeq === 'number') state.folioSeq = meta.folioSeq;
      if (Array.isArray(sales)) state.sales = sales;
      if (week && typeof week === 'object') state.week = week;
    } catch (_) { /* datos corruptos → se usan los de fábrica */ }
  }
  if (FS && FS.dataPath) {
    try { state.dataPath = await FS.dataPath(); } catch (_) { /* opcional */ }
  }
  render();
  if (SMOKE) runSmoke();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ---------------------------------------------------------- auto-prueba
   Abrir index.html?smoke=1 ejecuta el flujo completo y deja el resultado
   en <pre id="smoke-report">. En navegador no toca localStorage; en el
   escritorio escribe en la carpeta indicada por MASCOTLAN_DATA_DIR. */
async function runSmoke() {
  const out = [];
  const check = (name, cond) => out.push((cond ? 'OK   ' : 'FAIL ') + name);
  try {
    actions['login-dueno'](); render();
    check('login dueño → pos', state.screen === 'pos' && state.role === 'dueno');

    addProduct('j1'); addProduct('j1'); render();
    check('línea por pieza acumula cantidad', state.cart.length === 1 && state.cart[0].qty === 2);

    addProduct('a1'); render();
    check('producto a granel abre modal de peso', state.weightId === 'a1');

    state.weightVal = '0.500';
    actions['weight-confirm'](); render();
    check('línea kg agregada', state.cart.length === 2 && state.cart[1].weight === 0.5);

    const total = cartTotal();
    check('total correcto', Math.abs(total - (55 * 2 + 78 * 0.5)) < 1e-9);

    const j1Before = findProduct('j1').stock;
    const a1Before = findProduct('a1').stock;
    state.tendered = '200';
    charge(); render();
    check('ticket generado', !!state.ticket && /^MSC-\d{6}$/.test(state.ticket.folio));
    check('cambio correcto', state.ticket && Math.abs(state.ticket.change - (200 - total)) < 1e-9);
    check('stock por pieza descontado', findProduct('j1').stock === j1Before - 2);
    check('stock a granel descontado', Math.abs(findProduct('a1').stock - (a1Before - 0.5)) < 1e-9);
    check('venta registrada en el día', state.sales.length === 1 && state.sales[0].status === 'ok');

    closeTicket(); render();

    // dashboard con datos reales
    actions['nav']('dashboard'); render();
    const stats1 = todayStats();
    check('pantalla panel del dueño', state.screen === 'dashboard' && document.querySelector('.bars') != null);
    check('KPIs reales (1 ticket)', stats1.count === 1 && Math.abs(stats1.total - total) < 1e-9);
    check('top de productos con datos reales', document.querySelectorAll('.top-row').length === 2);

    // nuevo producto (flujo completo con validación)
    actions['nav']('inventory'); render();
    check('pantalla inventario', state.screen === 'inventory' && document.querySelector('.table') != null);
    const nBefore = state.products.length;
    actions['np-open']();
    setField('np.name', 'Producto Smoke');
    setField('np.price', '45,50');       // decimal con coma
    setField('np.stock', '12');
    actions['np-save'](); render();
    const creado = state.products[state.products.length - 1];
    check('nuevo producto guardado', state.products.length === nBefore + 1 && !state.showNewProduct);
    check('precio con coma aceptado', creado && creado.price === 45.5 && creado.stock === 12);
    actions['np-open']();
    actions['np-save']();
    check('validación muestra error', state.showNewProduct && !!state.npError);
    actions['np-cancel']();

    // imagen de producto: miniatura cuadrada recortada al centro
    const cnv = document.createElement('canvas');
    cnv.width = 640; cnv.height = 480;
    const cx = cnv.getContext('2d');
    cx.fillStyle = '#E4622F'; cx.fillRect(0, 0, 640, 480);
    const thumb = await resizeImage(cnv.toDataURL('image/png'));
    check('imagen redimensionada a miniatura', thumb.startsWith('data:image/jpeg') && thumb.length < 60000);

    // editar producto (y asignarle la imagen)
    const pEdit = state.products[state.products.length - 1];
    actions['ep-open'](pEdit.id); render();
    check('modal en modo edición', state.editId === pEdit.id && state.np.name === pEdit.name
      && /Editar producto/.test(document.querySelector('.np-modal').textContent));
    check('selector de imagen en el modal', !!document.querySelector('[data-file="np-img"]'));
    setField('np.name', 'Producto Editado');
    setField('np.price', '99,90');
    state.np.img = thumb;
    actions['np-save'](); render();
    check('edición guardada', !state.showNewProduct && pEdit.name === 'Producto Editado' && pEdit.price === 99.9);
    check('imagen guardada en el producto', pEdit.img === thumb);
    check('foto visible en inventario', !!document.querySelector('.t-row .avatar.has-img img'));
    actions['nav']('pos'); render();
    check('foto visible en el catálogo', !!document.querySelector('.prod-card .avatar.has-img img'));
    actions['nav']('inventory'); render();

    // borrar producto (con confirmación)
    const nAntes = state.products.length;
    addProduct(pEdit.id); // en el carrito, debe salir al borrarlo
    actions['dp-ask'](pEdit.id); render();
    check('modal de borrado', state.confirmDelete === pEdit.id && !!document.querySelector('.btn-danger'));
    actions['dp-confirm'](); render();
    check('producto borrado', state.products.length === nAntes - 1 && !findProduct(pEdit.id));
    check('borrado sale del ticket', !state.cart.some(c => c.id === pEdit.id));

    // el cajero no ve acciones de edición
    actions['nav']('inventory'); render();
    const accionesDueno = document.querySelectorAll('.row-actions').length;
    check('dueño ve botones de editar/borrar', accionesDueno === state.products.length);

    // ventas del día + revertir
    actions['nav']('sales'); render();
    check('pantalla ventas', state.screen === 'sales' && document.querySelector('.sales-row') != null);
    const folio = state.sales[0].folio;
    const j1AfterSale = findProduct('j1').stock;
    actions['revert-ask'](folio); render();
    check('modal de confirmación', !!document.querySelector('.btn-danger'));
    actions['revert-confirm'](); render();
    check('venta revertida', state.sales[0].status === 'cancelada');
    check('stock restaurado al revertir', findProduct('j1').stock === j1AfterSale + 2);
    const stats2 = todayStats();
    check('corte excluye la venta revertida', stats2.count === 0 && stats2.total === 0);

    actions['logout']();
    actions['login-cajero'](); render();
    check('cajero sin panel del dueño', document.querySelectorAll('.nav-btn').length === 3);
    actions['nav']('dashboard'); render();
    check('cajero no puede navegar al panel', state.screen === 'pos');
    actions['nav']('inventory'); render();
    check('cajero sin editar/borrar', document.querySelectorAll('.row-actions').length === 0);
  } catch (err) {
    out.push('ERROR ' + (err && err.message));
  }
  const pre = document.createElement('pre');
  pre.id = 'smoke-report';
  pre.textContent = out.join('\n');
  document.body.appendChild(pre);
}
