import { contextBridge, ipcRenderer } from 'electron';

declare global {
  interface Window {
    api: {
      updateSensitivities: (yaw: number, pitch: number) => Promise<{ success: boolean; error?: string }>;
      updateCalibration: (calibrationData: {
        both_closed_ratio?: number;
        l_wink_ratio?: number;
        r_wink_ratio?: number;
        wink_succ_frame?: number;
        wink_cooldown?: number;
      }) => Promise<{ success: boolean; error?: string }>;
      // NEW: Expose a way for renderer to listen for 'python-backend-ready'
      onPythonBackendReady: (callback: () => void) => () => void;
    };
  }
}

contextBridge.exposeInMainWorld('api', {
  updateSensitivities: (yaw: number, pitch: number) => ipcRenderer.invoke('update-sensitivities', yaw, pitch),
  updateCalibration: (calibrationData: any) => ipcRenderer.invoke('update-calibration', calibrationData)
});
