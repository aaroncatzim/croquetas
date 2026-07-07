/* ============================================================
   Mascotlan POS · cliente de Supabase (API REST, sin SDK)
   - login con correo/contraseña + lectura del perfil (rol)
   - fetchProducts / upsertProducts / deleteProduct sobre la
     tabla "productos"
   Ver supabase-schema.sql para crear las tablas.
   ============================================================ */
'use strict';

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
