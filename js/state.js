/* ============================================================
   Mascotlan POS · estado de la aplicación
   Todo lo que la interfaz muestra sale de este objeto `state`;
   las acciones lo modifican y render() lo vuelve a pintar.
   ============================================================ */
'use strict';

function emptyNp() {
  return { name: '', cat: 'Alimento', price: '', unit: 'pza', barcode: '', stock: '', img: '' };
}

function emptyContact() {
  return { facebook: '', instagram: '', whatsapp: '', telefono: '' };
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
  copied: false,                  // el ticket ya se copió al portapapeles
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
  contact: emptyContact(),        // contacto del negocio (página pública de catálogo)
  contactMsg: '',                 // resultado al guardar el contacto
  syncMsg: '',                    // aviso de sincronización con Supabase
  dataPath: '',                   // carpeta de datos (solo escritorio)
  _focus: null,                   // data-key a enfocar tras el próximo render
};
