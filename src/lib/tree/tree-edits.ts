import { parse as parseYaml } from 'yaml';

import type { TextChange, TextRange } from '../documents/text-change';
import type { DataValueKind } from './tree-model';

function parseYamlSafely(input: string): { isValid: boolean; value: unknown } {
  try {
    return { isValid: true, value: parseYaml(input) };
  } catch {
    return { isValid: false, value: undefined };
  }
}

function parseJsonSafely(input: string): { isValid: boolean; value: unknown } {
  try {
    return { isValid: true, value: JSON.parse(input) };
  } catch {
    return { isValid: false, value: undefined };
  }
}

function isJsonLiteral(value: unknown): boolean {
  return value === null || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Writes an edited JSON value. Strings stay strings; other values may become numbers, booleans or null
 * when typed as such, and anything else becomes a string.
 */
export function encodeJsonValue(input: string, originalKind: DataValueKind): string {
  if (originalKind === 'string') return JSON.stringify(input);
  const parsed = parseJsonSafely(input.trim());
  return parsed.isValid && isJsonLiteral(parsed.value) ? input.trim() : JSON.stringify(input);
}

export function encodeJsonKey(input: string): string {
  return JSON.stringify(input);
}

/**
 * Writes an edited YAML scalar the way it was written before: quoted values keep their quotes, plain values stay
 * plain unless the new text would mean something else in YAML (a number where a string was, `a: b`, `#`, …).
 */
export function encodeYamlScalar(input: string, originalSource: string, originalKind: DataValueKind): string {
  if (originalSource.startsWith('"')) return JSON.stringify(input);
  if (originalSource.startsWith("'")) return `'${input.replaceAll("'", "''")}'`;

  const parsed = parseYamlSafely(input);
  const isCollection = typeof parsed.value === 'object' && parsed.value !== null;
  const changesMeaning = typeof parsed.value === 'string' && parsed.value !== input;
  const losesStringType = originalKind === 'string' && typeof parsed.value !== 'string';
  const needsQuotes = !parsed.isValid || isCollection || changesMeaning || losesStringType || input.includes('\n');
  return needsQuotes ? JSON.stringify(input) : input;
}

export function encodeXmlText(input: string): string {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function encodeXmlAttributeValue(input: string, quote: '"' | "'"): string {
  const escaped = input.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return quote === '"' ? escaped.replaceAll('"', '&quot;') : escaped.replaceAll("'", '&apos;');
}

/** The change that replaces a range, or null when the text is already the same. */
export function createReplacement(text: string, range: TextRange, insert: string): TextChange | null {
  if (text.slice(range.from, range.to) === insert) return null;
  return { ...range, insert };
}
