const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mascotlan', {
  loadProducts:      ()      => ipcRenderer.invoke('store:loadProducts'),
  saveProducts:      p       => ipcRenderer.invoke('store:saveProducts', p),
  loadMeta:          ()      => ipcRenderer.invoke('store:loadMeta'),
  saveMeta:          m       => ipcRenderer.invoke('store:saveMeta', m),
  loadSales:         k       => ipcRenderer.invoke('store:loadSales', k),
  saveSales:         (k, s)  => ipcRenderer.invoke('store:saveSales', k, s),
  loadWeek:          keys    => ipcRenderer.invoke('store:loadWeek', keys),
  dataPath:          ()      => ipcRenderer.invoke('store:dataPath'),
  getSupabaseConfig: ()      => ipcRenderer.invoke('store:supabaseConfig'),
});
