/* ============================================================
   Mascotlan POS · página pública de catálogo (catalogo.html)
   Muestra los productos a la venta y el contacto del negocio.
   Lee la vista "catalogo" y la tabla "negocio" de Supabase sin
   iniciar sesión; sin Supabase muestra el catálogo local de
   fábrica (modo demostración).
   ============================================================ */
'use strict';

const cState = {
  products: null,   // null = cargando
  contact: null,
  query: '',
  cat: 'Todo',
  error: '',
};

/* ----- enlaces de contacto ----- */
function socialHref(base, v) {
  const s = String(v).trim();
  return /^https?:\/\//i.test(s) ? s : base + s.replace(/^@/, '').replace(/^\/+/, '');
}
function waHref(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length === 10) d = '52' + d; // 10 dígitos MX → lada internacional
  return 'https://wa.me/' + d;
}
function contactHtml() {
  const c = cState.contact || {};
  const links = [];
  if (c.whatsapp)  links.push({ cls: 'wa',  href: waHref(c.whatsapp), icon: I.wa('currentColor'), label: 'WhatsApp' });
  if (c.telefono)  links.push({ cls: 'tel', href: 'tel:' + String(c.telefono).replace(/[^\d+]/g, ''), icon: I.phone('currentColor'), label: c.telefono });
  if (c.facebook)  links.push({ cls: 'fb',  href: socialHref('https://facebook.com/', c.facebook), icon: I.fb(), label: 'Facebook' });
  if (c.instagram) links.push({ cls: 'ig',  href: socialHref('https://instagram.com/', c.instagram), icon: I.ig(), label: 'Instagram' });
  if (!links.length) return '';
  return `<div class="c-contact">${links.map(l =>
    `<a class="c-link ${l.cls}" href="${esc(l.href)}" target="_blank" rel="noopener">${l.icon}<span>${esc(l.label)}</span></a>`).join('')}</div>`;
}

/* ----- catálogo ----- */
function cVisible() {
  const q = cState.query.trim().toLowerCase();
  return (cState.products || [])
    .filter(p => cState.cat === 'Todo' || p.cat === cState.cat)
    .filter(p => !q || p.name.toLowerCase().includes(q));
}

function cChipsHtml() {
  return ['Todo', ...Object.keys(CATS)].map(name => {
    const cc = name === 'Todo' ? { c: '#D9531B', s: '#FCEBDE' } : catOf(name);
    return `<button class="chip${cState.cat === name ? ' active' : ''}" style="--c:${cc.c};--s:${cc.s}" data-cat="${name}">${name}</button>`;
  }).join('');
}

function cGridHtml() {
  if (cState.error) return `<div class="cat-error">${esc(cState.error)}</div>`;
  if (!cState.products) return '<div class="cat-error">Cargando catálogo…</div>';
  const cards = cVisible().map(p => {
    const cc = catOf(p.cat);
    const out = p.disponible === false;
    return `
    <div class="prod-card${out ? ' is-out' : ''}" style="--c:${cc.c};--s:${cc.s}">
      <div class="prod-top">
        ${avatarHtml(p, 'a40')}
        ${out ? '<span class="status st-out">Agotado</span>'
              : (p.unit === 'kg' ? '<span class="badge-granel">Granel</span>' : '')}
      </div>
      <div class="prod-name">${esc(p.name)}</div>
      <div class="prod-bottom">
        <span class="prod-price">${m(p.price)}</span>
        <span class="prod-unit">${p.unit === 'kg' ? '/ kg' : 'c/u'}</span>
      </div>
    </div>`;
  }).join('');
  return cards ? `<div class="prod-grid">${cards}</div>`
               : '<div class="no-results">Sin resultados para tu búsqueda.</div>';
}

/* Solo se repintan los chips y la cuadrícula: el buscador no pierde el foco. */
function cRefresh() {
  document.getElementById('c-chips').innerHTML = cChipsHtml();
  document.getElementById('c-grid').innerHTML = cGridHtml();
}

function cRender() {
  const catOptions = ['Todo', ...Object.keys(CATS)].map(name =>
    `<option value="${name}"${cState.cat === name ? ' selected' : ''}>${name === 'Todo' ? 'Todas las categorías' : name}</option>`).join('');
  document.getElementById('app').innerHTML = `
  <div class="cat-page">
    <header class="cat-hero">
      <div class="brand-row">
        <div class="logo logo-lg">${I.paw(34)}</div>
        <div class="brand-text">
          <div class="brand-name">${esc(CONFIG.brandName)}</div>
          <div class="brand-tag">Comida y artículos para tu mascota</div>
        </div>
      </div>
      ${contactHtml()}
    </header>
    <main>
      <div class="catalog-head">
        <div class="catalog-title">
          <h1>Nuestro catálogo</h1>
          <div class="hint">Precios en pesos mexicanos · pueden cambiar sin previo aviso</div>
        </div>
        <div class="search">
          ${I.search()}
          <input id="c-search" value="${esc(cState.query)}" placeholder="Buscar producto…">
        </div>
      </div>
      <div class="chips" id="c-chips">${cChipsHtml()}</div>
      <div class="cat-select">
        <select id="c-cat" aria-label="Categoría">${catOptions}</select>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B4A48F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div id="c-grid">${cGridHtml()}</div>
    </main>
    <footer class="cat-foot">
      🐾 ${esc(CONFIG.brandName)} · Para pedidos y dudas usa los botones de contacto de arriba.
    </footer>
  </div>`;
}

/* ----- eventos ----- */
document.addEventListener('input', e => {
  if (e.target.id === 'c-search') { cState.query = e.target.value; cRefresh(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'c-cat') { cState.cat = e.target.value; cRefresh(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (b) { cState.cat = b.dataset.cat; cRefresh(); }
});

/* ----- arranque ----- */
async function cInit() {
  SB = makeSupabase(window.SUPABASE_CONFIG || null);
  if (SB) {
    try {
      const [prods, negocio] = await Promise.all([
        SB.fetchCatalogo(),
        SB.fetchNegocio().catch(() => null),
      ]);
      cState.products = prods;
      cState.contact = negocio;
    } catch (_) {
      cState.error = 'No se pudo cargar el catálogo en este momento. Intenta de nuevo más tarde.';
    }
  } else {
    // sin Supabase: catálogo local de fábrica (modo demostración)
    cState.products = SEED_PRODUCTS.map(p => ({ ...p, disponible: p.stock > 0 }));
  }
  cRender();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cInit);
else cInit();
