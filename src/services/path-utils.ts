import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const PATIENT_ID_RE = /^\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPatientId(value: string): boolean {
  return PATIENT_ID_RE.test(value);
}

export function isValidDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function safePathUnderBase(baseDir: string, ...parts: string[]): string | null {
  const baseResolved = resolve(baseDir);
  const candidate = resolve(join(baseResolved, ...parts));

  if (!candidate.startsWith(baseResolved)) {
    return null;
  }

  return candidate;
}

export function listValidDateSubdirs(dirPath: string): string[] {
  try {
    return readdirSync(dirPath)
      .filter((name) => {
        const fullPath = join(dirPath, name);
        try {
          return statSync(fullPath).isDirectory() && isValidDate(name);
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

export function pathExistsAsDirectory(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function pathExistsAsFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}
