import { randomUUID } from "crypto";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  protocol,
  shell,
} from "electron";
import { join } from "path";
import {
  AppSettings,
  DataSourceManager,
  ReportKey,
  SettingsStore,
  ThemeMode,
} from "../src/data-sources";

const REPORT_SCHEME = "wepl-report";

protocol.registerSchemesAsPrivileged([
  {
    scheme: REPORT_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

interface StoredReport {
  content: string;
  mimeType: string;
}

let mainWindow: BrowserWindow | null = null;
let activeReportId: string | null = null;
const reportStore = new Map<string, StoredReport>();
const settingsStore = new SettingsStore();
const dataSourceManager = new DataSourceManager(settingsStore);

function clearStoredReport(id: string | null): void {
  if (id) {
    reportStore.delete(id);
  }
}

function storeReport(content: string, mimeType: string): string {
  clearStoredReport(activeReportId);
  const id = randomUUID();
  reportStore.set(id, { content, mimeType });
  activeReportId = id;
  return id;
}

function getRendererPath(page: string): string {
  return join(__dirname, "../../renderer", page);
}

function applyNativeTheme(theme: ThemeMode): void {
  if (theme === "system") {
    nativeTheme.themeSource = "system";
    return;
  }
  nativeTheme.themeSource = theme;
}

function createWindow(): void {
  const settings = settingsStore.getSettings();
  applyNativeTheme(settings.theme);

  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    title: "WEPL Report Viewer",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(getRendererPath("index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("settings:get", () => settingsStore.getSettings());

  ipcMain.handle("settings:update", (_event, partial: Partial<AppSettings>) => {
    const settings = settingsStore.updateSettings(partial);
    applyNativeTheme(settings.theme);
    dataSourceManager.getActiveSources();
    return settings;
  });

  ipcMain.handle(
    "settings:add-api",
    (_event, input: { name: string; baseUrl: string; enabled?: boolean }) => {
      return settingsStore.addApiSource({
        name: input.name,
        baseUrl: input.baseUrl,
        enabled: input.enabled ?? true,
      });
    }
  );

  ipcMain.handle(
    "settings:update-api",
    (
      _event,
      payload: {
        id: string;
        name?: string;
        baseUrl?: string;
        enabled?: boolean;
      }
    ) => {
      const { id, ...updates } = payload;
      return settingsStore.updateApiSource(id, updates);
    }
  );

  ipcMain.handle("settings:remove-api", (_event, id: string) => {
    return settingsStore.removeApiSource(id);
  });

  ipcMain.handle("dialog:pick-directory", async () => {
    const dialogOptions = {
      properties: ["openDirectory", "createDirectory"] as Array<
        "openDirectory" | "createDirectory"
      >,
      title: "Select local WEPL output directory",
    };

    const parent = mainWindow ?? BrowserWindow.getFocusedWindow();
    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("search:reports", async (_event, patientId: string, dob: string) => {
    return dataSourceManager.searchAll(patientId, dob);
  });

  ipcMain.handle("reports:list", async () => {
    return dataSourceManager.listAll();
  });

  ipcMain.handle(
    "report:get",
    async (
      _event,
      payload: {
        sourceId: string;
        patientId: string;
        scanDate: string;
        dob: string;
        reportKey: ReportKey;
      }
    ) => {
      const report = await dataSourceManager.getReport(
        payload.sourceId,
        payload.patientId,
        payload.scanDate,
        payload.dob,
        payload.reportKey
      );

      if (!report) {
        return null;
      }

      const id = storeReport(report.content, report.mimeType);
      return {
        id,
        sourceName: report.sourceName,
      };
    }
  );

  ipcMain.handle("report:open-external", async (_event, url: string) => {
    await shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  protocol.handle(REPORT_SCHEME, (request) => {
    const url = new URL(request.url);
    const id = url.hostname || url.pathname.replace(/^\//, "");
    const stored = reportStore.get(id);

    if (!stored) {
      return new Response("Report not found", { status: 404 });
    }

    return new Response(stored.content, {
      headers: { "Content-Type": stored.mimeType },
    });
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
