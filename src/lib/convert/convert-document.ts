import { parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import type { ParseError } from 'jsonc-parser';
import Papa from 'papaparse';
import { parseAllDocuments, stringify as stringifyYaml } from 'yaml';

import { FILE_KIND } from '../documents/file-kind';
import type { FileKind } from '../documents/file-kind';
import { parseCsv } from '../csv/csv-model';
import { err, ok } from '../result';
import type { Result } from '../result';

/** The kinds that hold structured data and can be converted into each other. */
export const CONVERTIBLE_KINDS = [FILE_KIND.json, FILE_KIND.yaml, FILE_KIND.csv] as const;
export type ConvertibleKind = (typeof CONVERTIBLE_KINDS)[number];

export interface ConvertOptions {
  tabSize: number;
  /** For CSV input: use the first row as property names (objects), or keep plain rows (arrays). */
  isFirstRowHeader: boolean;
}

export function isConvertibleKind(kind: FileKind): kind is ConvertibleKind {
  return CONVERTIBLE_KINDS.some((convertibleKind) => convertibleKind === kind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(text: string): Result<unknown> {
  const errors: ParseError[] = [];
  const value: unknown = parseJsonc(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) return err(`The JSON has a problem: ${printParseErrorCode(errors[0].error)}. Fix it first, then convert.`);
  return ok(value);
}

function readYaml(text: string): Result<unknown> {
  const documents = parseAllDocuments(text);
  const documentList = Array.isArray(documents) ? documents : [documents];
  const firstError = documentList.flatMap((document) => document.errors)[0];
  if (firstError) return err(`The YAML has a problem: ${firstError.message}`);
  const values = documentList.map((document) => document.toJS());
  return ok(values.length === 1 ? values[0] : values);
}

function readCsv(text: string, isFirstRowHeader: boolean): Result<unknown> {
  const { rows } = parseCsv(text);
  if (!isFirstRowHeader) return ok(rows);
  const [header = [], ...bodyRows] = rows;
  return ok(bodyRows.map((row) => Object.fromEntries(header.map((name, index) => [name || `column${index + 1}`, row[index] ?? '']))));
}

/** A table cell: text as it is, anything structured as compact JSON. */
function toCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function writeCsv(value: unknown): Result<string> {
  if (!Array.isArray(value)) return err('Only a list can become a table. Convert a list of objects (rows) or a list of lists.');
  if (value.every(Array.isArray)) {
    return ok(`${Papa.unparse(value.map((row) => row.map(toCell)), { newline: '\n' })}\n`);
  }
  if (!value.every(isRecord)) return err('Every item in the list needs to be an object (one row each) to become a table.');

  const columns: string[] = [];
  for (const row of value) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  const rows = value.map((row) => columns.map((column) => toCell(row[column])));
  return ok(`${Papa.unparse([columns, ...rows], { newline: '\n' })}\n`);
}

function readValue(text: string, kind: ConvertibleKind, options: ConvertOptions): Result<unknown> {
  if (kind === FILE_KIND.json) return readJson(text);
  if (kind === FILE_KIND.yaml) return readYaml(text);
  return readCsv(text, options.isFirstRowHeader);
}

function writeValue(value: unknown, kind: ConvertibleKind, options: ConvertOptions): Result<string> {
  if (kind === FILE_KIND.json) return ok(`${JSON.stringify(value, null, options.tabSize)}\n`);
  if (kind === FILE_KIND.yaml) return ok(stringifyYaml(value, { indent: options.tabSize }));
  return writeCsv(value);
}

/** Converts a JSON, YAML or CSV document into another of those formats. */
export function convertDocument(text: string, fromKind: ConvertibleKind, toKind: ConvertibleKind, options: ConvertOptions): Result<string> {
  const value = readValue(text, fromKind, options);
  if (!value.isOk) return value;
  return writeValue(value.value, toKind, options);
}
