/**
 * Preload — expose a tiny desktop API to the renderer.
 * Browser builds leave window.heroLineWarsDesktop undefined.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("heroLineWarsDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  quit: () => ipcRenderer.send("app-quit"),
});
