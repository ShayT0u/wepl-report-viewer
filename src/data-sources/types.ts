export const ALLOWED_REPORTS = {
  polar: "wepl_polar.html",
  cdf: "wepl_cdf.html",
  hist: "wepl_hist.html",
  pdf: "wepl_pdf.html",
} as const;

export type ReportKey = keyof typeof ALLOWED_REPORTS;

export interface ReportLink {
  label: string;
  reportKey: ReportKey;
  sourceId: string;
  sourceName: string;
}

export interface SearchMatch {
  patientId: string;
  dob: string;
  scanDate: string;
  folderPath: string;
  reports: ReportLink[];
  sourceId: string;
  sourceName: string;
}

export interface SearchResult {
  error: string | null;
  patientId: string;
  dob: string;
  matches: SearchMatch[];
}

export interface ReportContent {
  content: string;
  mimeType: string;
  sourceId: string;
  sourceName: string;
}

export interface LocalDataSourceConfig {
  id: string;
  type: "local";
  name: string;
  enabled: boolean;
  basePath: string;
}

export interface ApiDataSourceConfig {
  id: string;
  type: "api";
  name: string;
  enabled: boolean;
  baseUrl: string;
  headers?: Record<string, string>;
}

export type DataSourceConfig = LocalDataSourceConfig | ApiDataSourceConfig;

export interface DataSource {
  readonly id: string;
  readonly name: string;
  readonly type: "local" | "api";
  searchReports(patientId: string, dob: string): Promise<SearchResult>;
  listReports(): Promise<SearchResult>;
  getReportContent(
    patientId: string,
    scanDate: string,
    dob: string,
    reportKey: ReportKey
  ): Promise<ReportContent | null>;
}
