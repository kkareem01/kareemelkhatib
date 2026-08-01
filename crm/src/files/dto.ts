/** Wire shape for file records (never exposes r2_key). */

import type { FileRecord } from "../types";

export interface FileDto {
  readonly id: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export function fileToDto(record: FileRecord): FileDto {
  return {
    id: record.id,
    name: record.name,
    mime: record.mime,
    size: record.size,
    tags: parseTags(record.tags),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function parseTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
