import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lubanai', {
  getGatewayStatus: () => ipcRenderer.invoke('get-gateway-status'),
  openDashboard: () => ipcRenderer.invoke('open-dashboard'),
  openConfig: () => ipcRenderer.invoke('open-config'),
});
