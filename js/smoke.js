/* ============================================================
   Mascotlan POS · auto-prueba (smoke test)
   Abrir index.html?smoke=1 ejecuta el flujo completo y deja el
   resultado en <pre id="smoke-report">. En navegador no toca
   localStorage; en el escritorio escribe en la carpeta indicada
   por MASCOTLAN_DATA_DIR. También: `npm run smoke`.
   ============================================================ */
'use strict';

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

    // copiar ticket y enlace al catálogo público
    render();
    check('botón de copiar ticket', !!document.querySelector('[data-action="copy-ticket"]'));
    const txt = ticketText(state.ticket, false);
    check('texto del ticket listo para pegar', txt.includes(state.ticket.folio) && txt.includes('Total:') && txt.includes('Cambio:'));
    check('enlace al catálogo para clientes', !CONFIG.catalogUrl || !!document.querySelector('a.nav-btn[target="_blank"]'));

    closeTicket(); render();

    // dashboard con datos reales
    actions['nav']('dashboard'); render();
    const stats1 = todayStats();
    check('pantalla panel del dueño', state.screen === 'dashboard' && document.querySelector('.bars') != null);
    check('KPIs reales (1 ticket)', stats1.count === 1 && Math.abs(stats1.total - total) < 1e-9);
    check('top de productos con datos reales', document.querySelectorAll('.top-row').length === 2);

    // contacto de la página pública de catálogo (editable en el panel)
    check('panel: campos de contacto del catálogo', !!document.querySelector('[data-input="contact.whatsapp"]'));
    setField('contact.whatsapp', '5512345678');
    setField('contact.instagram', '@mascotlan');
    actions['contact-save'](); render();
    check('contacto guardado', state.contact.whatsapp === '5512345678'
      && state.contact.instagram === '@mascotlan' && !!state.contactMsg);

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
    check('cajero sin panel del dueño', document.querySelectorAll('button.nav-btn').length === 3);
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
