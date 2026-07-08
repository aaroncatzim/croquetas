/* ============================================================
   Mascotlan POS · acciones (lógica de negocio)
   - Carrito: addProduct, changeQty
   - Venta: charge (cobrar), revertSale, sendWhatsApp
   - Productos: saveNewProduct (alta/edición), deleteProduct, pickImage
   - Sesión: doLoginSupabase
   - `actions`: mapa data-action → función (lo usan los botones)
   ============================================================ */
'use strict';

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
  state.copied = false;

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
  state.copied = false;
}

/* Texto del ticket (para WhatsApp o para copiar y pegar). */
function ticketText(tk, paraWhatsApp) {
  const marca = paraWhatsApp ? `*${CONFIG.brandName}*` : CONFIG.brandName;
  const rows = tk.lines.map(l => `${qtyLabel(l)} · ${l.name} — ${m(l.lineTotal)}`).join('\n');
  return [
    `🐾 ${marca} · Ticket ${tk.folio}`,
    tk.dateLabel,
    '——————————————',
    rows,
    '——————————————',
    `Total: ${m(tk.total)}`,
    `Efectivo: ${m(tk.tend)}`,
    `Cambio: ${m(tk.change)}`,
    '¡Gracias por consentir a tu mascota! 🐾',
  ].join('\n');
}

function sendWhatsApp() {
  const tk = state.ticket;
  if (!tk) return;
  const text = ticketText(tk, true);
  let digits = state.phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '52' + digits; // 10 dígitos MX → lada internacional
  const url = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
  state.waSent = true;
}

/* Copia el ticket al portapapeles para pegarlo donde sea. */
function copyTicket() {
  const tk = state.ticket;
  if (!tk) return;
  const text = ticketText(tk, false);
  const listo = ok => { state.copied = ok; render(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => listo(true)).catch(() => listo(copyFallback(text)));
  } else {
    listo(copyFallback(text));
  }
}
function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { /* sin portapapeles */ }
  ta.remove();
  return ok;
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

/* Lee el archivo elegido en el selector de imagen del modal de producto. */
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

/* Mapa data-action → función. Devolver false = no re-renderizar. */
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
  'copy-ticket':   () => copyTicket(),
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
  'contact-save': () => {
    Object.keys(state.contact).forEach(k => { state.contact[k] = String(state.contact[k]).trim(); });
    persistContact();
  },
};

/* Escribe el valor de un input (data-input) en el estado. */
function setField(field, value) {
  if (field.startsWith('np.')) { state.np[field.slice(3)] = value; state.npError = ''; }
  else if (field.startsWith('login.')) { state.login[field.slice(6)] = value; state.login.error = ''; }
  else if (field.startsWith('contact.')) { state.contact[field.slice(8)] = value; state.contactMsg = ''; }
  else state[field] = value;
}
