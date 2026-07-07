/* ============================================================
   Mascotlan POS · funciones auxiliares
   - Fechas (todayKey, lastDays), formato de dinero (m) y texto (esc)
   - Cálculos del carrito (buildLines, cartTotal) y ventas (dayTotals)
   - Imágenes de producto (avatarHtml, resizeImage)
   ============================================================ */
'use strict';

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
