const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SMOKE = process.argv.includes('--smoke');

/* ------------------------------------------------ carpeta de datos
   Desarrollo: <proyecto>/data · App empaquetada: ~/Documents/Mascotlan POS
   Se puede forzar con la variable de entorno MASCOTLAN_DATA_DIR. */
function dataDir() {
  if (process.env.MASCOTLAN_DATA_DIR) return process.env.MASCOTLAN_DATA_DIR;
  if (app.isPackaged) return path.join(app.getPath('documents'), 'Mascotlan POS');
  return path.join(__dirname, 'data');
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function ensureDirs() {
  fs.mkdirSync(path.join(dataDir(), 'ventas'), { recursive: true });
  // plantilla de configuración de Supabase junto a los datos
  const sbFile = path.join(dataDir(), 'supabase.json');
  if (!fs.existsSync(sbFile)) {
    fs.writeFileSync(sbFile, JSON.stringify({ url: '', anonKey: '' }, null, 2));
  }
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function salesFile(dateKey) {
  if (!DATE_KEY.test(dateKey)) throw new Error('fecha inválida: ' + dateKey);
  return path.join(dataDir(), 'ventas', 'ventas-' + dateKey + '.json');
}

function registerStore() {
  ipcMain.handle('store:loadProducts', () => readJSON(path.join(dataDir(), 'productos.json'), null));
  ipcMain.handle('store:saveProducts', (e, p) => writeJSON(path.join(dataDir(), 'productos.json'), p));
  ipcMain.handle('store:loadMeta', () => readJSON(path.join(dataDir(), 'config.json'), null));
  ipcMain.handle('store:saveMeta', (e, m) => writeJSON(path.join(dataDir(), 'config.json'), m));
  ipcMain.handle('store:loadSales', (e, k) => readJSON(salesFile(k), []));
  ipcMain.handle('store:saveSales', (e, k, s) => writeJSON(salesFile(k), s));
  ipcMain.handle('store:loadWeek', (e, keys) => {
    const out = {};
    (keys || []).forEach(k => {
      const sales = readJSON(salesFile(k), []);
      const ok = sales.filter(s => s && s.status === 'ok');
      out[k] = {
        total: Math.round(ok.reduce((a, s) => a + (s.total || 0), 0) * 100) / 100,
        count: ok.length,
      };
    });
    return out;
  });
  ipcMain.handle('store:dataPath', () => dataDir());
  ipcMain.handle('store:supabaseConfig', () => readJSON(path.join(dataDir(), 'supabase.json'), null));
}

/* ------------------------------------------------------ ventana */
function isExternal(url) {
  return /^https?:/i.test(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    show: !SMOKE,
    title: 'Mascotlan POS',
    backgroundColor: '#FBF6EE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'), SMOKE ? { query: { smoke: '1' } } : undefined);

  // Los enlaces externos (WhatsApp) se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isExternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

/* Modo --smoke: corre la auto-prueba, imprime el reporte y termina. */
async function runSmoke(win) {
  const deadline = Date.now() + 20000;
  const poll = async () => {
    const report = await win.webContents.executeJavaScript(
      `(document.getElementById('smoke-report') || {}).textContent || null`
    );
    if (report != null) {
      process.stdout.write(report + '\n');
      app.exit(/FAIL|ERROR/.test(report) ? 1 : 0);
      return;
    }
    if (Date.now() > deadline) {
      process.stdout.write('ERROR smoke: sin reporte tras 20s\n');
      app.exit(1);
      return;
    }
    setTimeout(poll, 300);
  };
  win.webContents.once('did-finish-load', () => setTimeout(poll, 400));
}

app.whenReady().then(() => {
  ensureDirs();
  registerStore();
  const win = createWindow();
  if (SMOKE) runSmoke(win);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
