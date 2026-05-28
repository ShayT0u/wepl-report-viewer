import {
  ALLOWED_REPORTS,
  ApiDataSourceConfig,
  ReportContent,
  ReportKey,
  SearchMatch,
  SearchResult,
} from "./types";
import { isValidDate, isValidPatientId } from "../services/path-utils";

interface ApiSearchResponse {
  matches?: Array<{
    scan_date: string;
    folder_path: string;
    reports?: Array<{
      label: string;
      report_key: ReportKey;
    }>;
  }>;
  error?: string;
}

export class ApiDataSource {
  readonly id: string;
  readonly name: string;
  readonly type = "api" as const;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: ApiDataSourceConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.headers = config.headers ?? {};
  }

  async searchReports(patientId: string, dob: string): Promise<SearchResult> {
    const validationError = this.validateSearchInput(patientId, dob);
    if (validationError) {
      return this.emptyResult(patientId, dob, validationError);
    }

    try {
      const url = new URL(`${this.baseUrl}/search`);
      url.searchParams.set("patient_id", patientId);
      url.searchParams.set("dob", dob);

      const response = await fetch(url.toString(), {
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return this.emptyResult(
          patientId,
          dob,
          `API source "${this.name}" returned ${response.status}.`
        );
      }

      const payload = (await response.json()) as ApiSearchResponse;
      if (payload.error) {
        return this.emptyResult(patientId, dob, payload.error);
      }

      const matches: SearchMatch[] = (payload.matches ?? []).map((match) => ({
        scanDate: match.scan_date,
        folderPath: match.folder_path,
        reports: (match.reports ?? []).map((report) => ({
          label: report.label,
          reportKey: report.report_key,
          sourceId: this.id,
          sourceName: this.name,
        })),
        sourceId: this.id,
        sourceName: this.name,
      }));

      if (matches.length === 0) {
        return this.emptyResult(
          patientId,
          dob,
          `No results from API source "${this.name}".`
        );
      }

      return {
        error: null,
        patientId,
        dob,
        matches,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown API error";
      return this.emptyResult(
        patientId,
        dob,
        `API source "${this.name}" failed: ${message}`
      );
    }
  }

  async getReportContent(
    patientId: string,
    scanDate: string,
    dob: string,
    reportKey: ReportKey
  ): Promise<ReportContent | null> {
    if (
      !isValidPatientId(patientId) ||
      !isValidDate(scanDate) ||
      !isValidDate(dob) ||
      !(reportKey in ALLOWED_REPORTS)
    ) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/report/${patientId}/${scanDate}/${dob}/${reportKey}`;
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "text/html";
      const content = await response.text();

      return {
        content,
        mimeType: contentType,
        sourceId: this.id,
        sourceName: this.name,
      };
    } catch {
      return null;
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      ...this.headers,
    };
  }

  private validateSearchInput(patientId: string, dob: string): string | null {
    if (!patientId || !dob) {
      return "Missing input: please enter both Patient ID and DOB.";
    }
    if (!isValidPatientId(patientId)) {
      return "Patient ID must contain digits only.";
    }
    if (!isValidDate(dob)) {
      return "DOB must be a valid date in YYYY-MM-DD format.";
    }
    return null;
  }

  private emptyResult(
    patientId: string,
    dob: string,
    error: string,
    matches: SearchMatch[] = []
  ): SearchResult {
    return { error, patientId, dob, matches };
  }
}
