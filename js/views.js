/* ============================================================
   Mascotlan POS · vistas (HTML de cada pantalla y modal)
   - html(): arma la pantalla completa según state.screen
   - Pantallas: login, cobrar (POS), inventario, ventas, panel
   - Modales: peso a granel, ticket, producto, borrar, revertir
   ============================================================ */
'use strict';

function html() {
  if (state.screen === 'login') return renderLogin();
  return renderShell() + renderWeightModal() + renderTicketModal()
       + renderNewProductModal() + renderRevertModal() + renderDeleteModal();
}

/* ----- Login ----- */
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

/* ----- Estructura general (barra lateral + contenido) ----- */
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
      ${isDueno ? nav('dashboard', I.chart(), '<span class="lbl-lg">Panel del dueño</span><span class="lbl-sm">Panel</span>') : ''}
      ${CONFIG.catalogUrl ? `
      <a class="nav-btn" href="${esc(CONFIG.catalogUrl)}" target="_blank" rel="noopener" title="Abrir la página que ven tus clientes">
        ${I.ext()}<span class="lbl-lg">Catálogo para clientes</span><span class="lbl-sm">Catálogo</span>
      </a>` : ''}
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

/* ----- POS (Cobrar) ----- */
function renderPos() {
  return `<div class="pos">${renderCatalog()}${renderCart()}</div>`;
}

function renderCatalog() {
  const chips = ['Todo', ...Object.keys(CATS)].map(name => {
    const cc = name === 'Todo' ? { c: '#D9531B', s: '#FCEBDE' } : catOf(name);
    return `<button class="chip${state.cat === name ? ' active' : ''}" style="--c:${cc.c};--s:${cc.s}" data-action="set-cat" data-arg="${name}">${name}</button>`;
  }).join('');

  // en móvil las categorías se eligen con un dropdown (los chips se ocultan por CSS)
  const catOptions = ['Todo', ...Object.keys(CATS)].map(name =>
    `<option value="${name}"${state.cat === name ? ' selected' : ''}>${name === 'Todo' ? 'Todas las categorías' : name}</option>`).join('');

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
    <div class="cat-select">
      <select data-input="cat" data-key="cat" aria-label="Categoría">${catOptions}</select>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B4A48F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </div>
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
        <div class="card top-card">
          <div class="card-head">
            <h3>Página pública del catálogo</h3>
            ${CONFIG.catalogUrl
              ? `<a class="card-link" href="${esc(CONFIG.catalogUrl)}" target="_blank" rel="noopener">${esc(CONFIG.catalogUrl.replace(/^https?:\/\//, ''))} ${I.arrow()}</a>`
              : '<span class="card-note">Contacto que ven tus clientes en catalogo.html</span>'}
          </div>
          <div class="contact-grid">
            <div class="field">
              <label>WhatsApp</label>
              <input data-input="contact.whatsapp" data-key="c_wa" inputmode="tel"
                     value="${esc(state.contact.whatsapp)}" placeholder="10 dígitos, ej. 5512345678">
            </div>
            <div class="field">
              <label>Teléfono</label>
              <input data-input="contact.telefono" data-key="c_tel" inputmode="tel"
                     value="${esc(state.contact.telefono)}" placeholder="10 dígitos">
            </div>
            <div class="field">
              <label>Facebook</label>
              <input data-input="contact.facebook" data-key="c_fb"
                     value="${esc(state.contact.facebook)}" placeholder="usuario o enlace de tu página">
            </div>
            <div class="field">
              <label>Instagram</label>
              <input data-input="contact.instagram" data-key="c_ig"
                     value="${esc(state.contact.instagram)}" placeholder="@usuario o enlace">
            </div>
          </div>
          <div class="contact-foot">
            ${state.contactMsg ? `<span class="contact-msg">${esc(state.contactMsg)}</span>` : '<span class="hint">Deja vacío lo que no quieras mostrar.</span>'}
            <button class="btn-primary" data-action="contact-save">Guardar contacto</button>
          </div>
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
        <button class="btn-outline" data-action="copy-ticket">${I.copy()}${state.copied ? 'Ticket copiado ✓' : 'Copiar ticket'}</button>
        <button class="btn-outline" data-action="download-pdf">${I.download()}Descargar PDF</button>
        <button class="link-new" data-action="ticket-close">Nueva venta →</button>
      </div>
    </div>
  </div>`;
}

/* ----- Modal: nuevo producto / editar producto ----- */
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

/* ----- Modal: confirmar reversión de venta ----- */
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
