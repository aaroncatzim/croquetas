/* ============================================================
   Mascotlan POS · almacenamiento
   - Escritorio (Electron): archivos JSON en la carpeta de datos
     (productos.json, config.json, ventas/ventas-AAAA-MM-DD.json)
   - Navegador: localStorage (una clave por día para las ventas)
   - persistProducts/persistSales/persistMeta: guardan y, si hay
     sesión de Supabase, sincronizan el catálogo.
   ============================================================ */
'use strict';

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
    return d ? { folioSeq: d.folioSeq, contacto: d.contacto } : null;
  },
  saveMeta: async m => lsWrite(STORAGE_KEY, { ...(lsRead(STORAGE_KEY) || {}), folioSeq: m.folioSeq, contacto: m.contacto }),
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
  Promise.resolve(Store.saveMeta({ folioSeq: state.folioSeq, contacto: state.contact })).catch(() => {});
}

/* Contacto del negocio: se guarda local y se publica en Supabase para
   que la página pública de catálogo (catalogo.html) lo muestre. */
function persistContact() {
  persistMeta();
  if (SB && SB.hasSession()) {
    state.contactMsg = 'Guardando…';
    SB.saveNegocio(state.contact)
      .then(() => { state.contactMsg = 'Guardado — la página del catálogo ya muestra los nuevos datos.'; render(); })
      .catch(() => { state.contactMsg = 'Guardado en esta caja, pero sin conexión con Supabase: la página pública no se actualizó.'; render(); });
  } else {
    state.contactMsg = 'Guardado en esta caja.';
  }
}

/* Cambio de día: las ventas de hoy pasan al histórico de la semana. */
function ensureToday() {
  const k = todayKey();
  if (state.salesDate === k) return;
  state.week[state.salesDate] = dayTotals(state.sales);
  state.salesDate = k;
  state.sales = [];
}
