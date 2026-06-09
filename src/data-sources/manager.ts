import { randomUUID } from "crypto";
import Store from "electron-store";
import { ApiDataSource } from "./api-source";
import { LocalFileDataSource } from "./local-file-source";
import {
  ApiDataSourceConfig,
  DataSource,
  DataSourceConfig,
  LocalDataSourceConfig,
  ReportContent,
  ReportKey,
  SearchMatch,
  SearchResult,
} from "./types";

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  theme: ThemeMode;
  localDataDirectory: string;
  apiSources: ApiDataSourceConfig[];
}

const defaultSettings: AppSettings = {
  theme: "system",
  localDataDirectory: "",
  apiSources: [],
};

export class SettingsStore {
  private readonly store = new Store<{ settings: AppSettings }>({
    name: "wepl-report-viewer-settings",
    defaults: { settings: defaultSettings },
  });

  getSettings(): AppSettings {
    return this.store.get("settings");
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const next = { ...this.getSettings(), ...partial };
    this.store.set("settings", next);
    return next;
  }

  addApiSource(input: Omit<ApiDataSourceConfig, "id" | "type">): AppSettings {
    const settings = this.getSettings();
    const apiSources = [
      ...settings.apiSources,
      {
        id: randomUUID(),
        type: "api" as const,
        ...input,
      },
    ];
    return this.updateSettings({ apiSources });
  }

  updateApiSource(
    id: string,
    input: Partial<Omit<ApiDataSourceConfig, "id" | "type">>
  ): AppSettings {
    const settings = this.getSettings();
    const apiSources = settings.apiSources.map((source) =>
      source.id === id ? { ...source, ...input } : source
    );
    return this.updateSettings({ apiSources });
  }

  removeApiSource(id: string): AppSettings {
    const settings = this.getSettings();
    const apiSources = settings.apiSources.filter((source) => source.id !== id);
    return this.updateSettings({ apiSources });
  }
}

function buildDataSourceConfigs(settings: AppSettings): DataSourceConfig[] {
  const sources: DataSourceConfig[] = [
    {
      id: "local-default",
      type: "local",
      name: "Local Files",
      enabled: Boolean(settings.localDataDirectory),
      basePath: settings.localDataDirectory,
    },
    ...settings.apiSources,
  ];

  return sources.filter((source) => source.enabled);
}

function createDataSource(config: DataSourceConfig): DataSource {
  if (config.type === "local") {
    return new LocalFileDataSource(config);
  }
  return new ApiDataSource(config);
}

export class DataSourceManager {
  constructor(private readonly settingsStore: SettingsStore) {}

  getActiveSources(): DataSource[] {
    const settings = this.settingsStore.getSettings();
    return buildDataSourceConfigs(settings).map(createDataSource);
  }

  async searchAll(patientId: string, dob: string): Promise<SearchResult> {
    const sources = this.getActiveSources();

    if (sources.length === 0) {
      return {
        error:
          "No data sources configured. Open Settings to set a local directory or add an API.",
        patientId,
        dob,
        matches: [],
      };
    }

    const results = await Promise.all(
      sources.map((source) => source.searchReports(patientId, dob))
    );

    const matches = results.flatMap((result) => result.matches);
    const errors = results
      .map((result) => result.error)
      .filter((error): error is string => Boolean(error));

    if (matches.length === 0) {
      return {
        error: errors[0] ?? "No matching reports found in any configured source.",
        patientId,
        dob,
        matches: [],
      };
    }

    return {
      error: null,
      patientId,
      dob,
      matches: sortMatches(matches),
    };
  }

  async listAll(): Promise<SearchResult> {
    const sources = this.getActiveSources();

    if (sources.length === 0) {
      return {
        error:
          "No data sources configured. Open Settings to set a local directory or add an API.",
        patientId: "",
        dob: "",
        matches: [],
      };
    }

    const results = await Promise.all(
      sources.map((source) => source.listReports())
    );

    const matches = results.flatMap((result) => result.matches);
    const errors = results
      .map((result) => result.error)
      .filter((error): error is string => Boolean(error));

    if (matches.length === 0) {
      return {
        error: errors[0] ?? "No reports found in any configured source.",
        patientId: "",
        dob: "",
        matches: [],
      };
    }

    return {
      error: null,
      patientId: "",
      dob: "",
      matches: sortMatches(matches),
    };
  }

  async getReport(
    sourceId: string,
    patientId: string,
    scanDate: string,
    dob: string,
    reportKey: ReportKey
  ): Promise<ReportContent | null> {
    const source = this.getActiveSources().find((item) => item.id === sourceId);
    if (!source) {
      return null;
    }

    return source.getReportContent(patientId, scanDate, dob, reportKey);
  }
}

function sortMatches(matches: SearchMatch[]): SearchMatch[] {
  return [...matches].sort((left, right) => {
    const sourceCompare = left.sourceName.localeCompare(right.sourceName);
    if (sourceCompare !== 0) {
      return sourceCompare;
    }
    const patientCompare = left.patientId.localeCompare(right.patientId, undefined, {
      numeric: true,
    });
    if (patientCompare !== 0) {
      return patientCompare;
    }
    return right.scanDate.localeCompare(left.scanDate);
  });
}
