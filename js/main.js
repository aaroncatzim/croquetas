/* ============================================================
   Mascotlan POS · render, eventos y arranque
   - render(): pinta html() en #app conservando foco y scroll
   - Listeners globales: clic (data-action), input (data-input),
     Enter/Escape y lector de código de barras
   - init(): carga datos guardados, crea el cliente Supabase y arranca
   ============================================================ */
'use strict';

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
  const winX = window.scrollX, winY = window.scrollY; // en móvil el scroll es de la página

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
  window.scrollTo(winX, winY);

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

/* ----- eventos globales ----- */
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

/* ----- arranque ----- */
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
