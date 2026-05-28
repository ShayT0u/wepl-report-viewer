import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("weplViewer", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (partial: Record<string, unknown>) =>
    ipcRenderer.invoke("settings:update", partial),
  addApiSource: (input: { name: string; baseUrl: string; enabled?: boolean }) =>
    ipcRenderer.invoke("settings:add-api", input),
  updateApiSource: (payload: {
    id: string;
    name?: string;
    baseUrl?: string;
    enabled?: boolean;
  }) => ipcRenderer.invoke("settings:update-api", payload),
  removeApiSource: (id: string) => ipcRenderer.invoke("settings:remove-api", id),
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory"),
  searchReports: (patientId: string, dob: string) =>
    ipcRenderer.invoke("search:reports", patientId, dob),
  listAllReports: () => ipcRenderer.invoke("reports:list"),
  getReport: (payload: {
    sourceId: string;
    patientId: string;
    scanDate: string;
    dob: string;
    reportKey: string;
  }) => ipcRenderer.invoke("report:get", payload),
});
