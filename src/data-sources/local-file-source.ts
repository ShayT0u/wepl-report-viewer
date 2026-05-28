import { readFileSync } from "fs";
import { join } from "path";
import {
  ALLOWED_REPORTS,
  LocalDataSourceConfig,
  ReportContent,
  ReportKey,
  ReportLink,
  SearchMatch,
  SearchResult,
} from "./types";
import {
  isValidDate,
  isValidPatientId,
  listSubdirs,
  listValidDateSubdirs,
  pathExistsAsDirectory,
  pathExistsAsFile,
  safePathUnderBase,
} from "../services/path-utils";

export class LocalFileDataSource {
  readonly id: string;
  readonly name: string;
  readonly type = "local" as const;
  private readonly basePath: string;

  constructor(config: LocalDataSourceConfig) {
    this.id = config.id;
    this.name = config.name;
    this.basePath = config.basePath;
  }

  async searchReports(patientId: string, dob: string): Promise<SearchResult> {
    const validationError = this.validateSearchInput(patientId, dob);
    if (validationError) {
      return this.emptyResult(patientId, dob, validationError);
    }

    const patientDir = safePathUnderBase(this.basePath, patientId);
    if (!patientDir || !pathExistsAsDirectory(patientDir)) {
      return this.emptyResult(
        patientId,
        dob,
        `Patient folder not found for ID ${patientId}.`
      );
    }

    const matches: SearchMatch[] = [];
    let dobFolderFound = false;
    let reportsFound = 0;

    for (const scanDate of listValidDateSubdirs(patientDir)) {
      const dobDir = safePathUnderBase(this.basePath, patientId, scanDate, dob);
      if (!dobDir || !pathExistsAsDirectory(dobDir)) {
        continue;
      }

      dobFolderFound = true;
      const reports = this.collectReports(dobDir);

      reportsFound += reports.length;
      matches.push({
        patientId,
        dob,
        scanDate,
        folderPath: dobDir,
        reports,
        sourceId: this.id,
        sourceName: this.name,
      });
    }

    if (!dobFolderFound) {
      return this.emptyResult(
        patientId,
        dob,
        `No matching DOB/report folders found for DOB ${dob}.`
      );
    }

    if (reportsFound === 0) {
      return this.emptyResult(
        patientId,
        dob,
        "DOB folder(s) found, but no expected report files were found.",
        matches
      );
    }

    return {
      error: null,
      patientId,
      dob,
      matches,
    };
  }

  async listReports(): Promise<SearchResult> {
    if (!this.basePath || !pathExistsAsDirectory(this.basePath)) {
      return this.emptyResult(
        "",
        "",
        `Local directory not found: ${this.basePath}`
      );
    }

    const matches: SearchMatch[] = [];

    for (const patientId of listSubdirs(this.basePath).filter(isValidPatientId)) {
      const patientDir = safePathUnderBase(this.basePath, patientId);
      if (!patientDir) {
        continue;
      }

      for (const scanDate of listValidDateSubdirs(patientDir)) {
        const scanDir = safePathUnderBase(this.basePath, patientId, scanDate);
        if (!scanDir) {
          continue;
        }

        for (const dob of listValidDateSubdirs(scanDir)) {
          const dobDir = safePathUnderBase(
            this.basePath,
            patientId,
            scanDate,
            dob
          );
          if (!dobDir) {
            continue;
          }

          const reports = this.collectReports(dobDir);
          if (reports.length === 0) {
            continue;
          }

          matches.push({
            patientId,
            dob,
            scanDate,
            folderPath: dobDir,
            reports,
            sourceId: this.id,
            sourceName: this.name,
          });
        }
      }
    }

    if (matches.length === 0) {
      return this.emptyResult(
        "",
        "",
        `No reports found under ${this.basePath}.`
      );
    }

    return { error: null, patientId: "", dob: "", matches };
  }

  private collectReports(dobDir: string): ReportLink[] {
    const reports: ReportLink[] = [];

    for (const [reportKey, filename] of Object.entries(ALLOWED_REPORTS)) {
      if (pathExistsAsFile(join(dobDir, filename))) {
        reports.push({
          label: reportKey.toUpperCase(),
          reportKey: reportKey as ReportKey,
          sourceId: this.id,
          sourceName: this.name,
        });
      }
    }

    return reports;
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

    const filename = ALLOWED_REPORTS[reportKey];
    const reportPath = safePathUnderBase(
      this.basePath,
      patientId,
      scanDate,
      dob,
      filename
    );

    if (!reportPath || !pathExistsAsFile(reportPath)) {
      return null;
    }

    const content = readFileSync(reportPath, "utf-8");
    return {
      content,
      mimeType: "text/html",
      sourceId: this.id,
      sourceName: this.name,
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
