/* ============================================================
   Mascotlan POS · configuración y datos base
   - CONFIG: marca, pantalla inicial, umbral de stock, fondo de caja
   - CATS: categorías de producto (colores de etiqueta)
   - SEED_PRODUCTS: catálogo inicial de fábrica
   ============================================================ */
'use strict';

const CONFIG = {
  brandName: 'Mascotlan',
  startScreen: 'login',          // 'login' | 'pos' | 'inventory' | 'sales' | 'dashboard'
  lowStockThreshold: 10,
  cashFund: 260,                 // fondo inicial de caja para el corte
  // dirección pública del catálogo (se muestra como enlace en el Panel)
  catalogUrl: 'https://aaroncatzim.github.io/croquetas/catalogo.html',
};
const STORAGE_KEY = 'mascotlan-pos-v1';
const SMOKE = /[?&]smoke=1/.test(location.search); // auto-prueba: index.html?smoke=1

/* Puente a Electron (preload.js). Ausente cuando corre en navegador. */
const FS = window.mascotlan || null;
/* Cliente Supabase; se crea en init() si hay configuración. */
let SB = null;

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
