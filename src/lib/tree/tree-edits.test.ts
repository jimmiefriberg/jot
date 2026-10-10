import { describe, expect, test } from 'bun:test';

import { createReplacement, encodeJsonValue, encodeXmlAttributeValue, encodeXmlText, encodeYamlScalar } from './tree-edits';

describe('JSON', () => {
  test('keeps strings as strings', () => {
    expect(encodeJsonValue('42', 'string')).toBe('"42"');
    expect(encodeJsonValue('say "hi"', 'string')).toBe('"say \\"hi\\""');
  });

  test('lets other values become literals or strings', () => {
    expect(encodeJsonValue(' 7.5 ', 'number')).toBe('7.5');
    expect(encodeJsonValue('false', 'number')).toBe('false');
    expect(encodeJsonValue('null', 'boolean')).toBe('null');
    expect(encodeJsonValue('seven', 'number')).toBe('"seven"');
  });
});

describe('YAML', () => {
  test('keeps plain values plain when safe', () => {
    expect(encodeYamlScalar('ubuntu-24.04', 'ubuntu-latest', 'string')).toBe('ubuntu-24.04');
    expect(encodeYamlScalar('20', '10', 'number')).toBe('20');
  });

  test('quotes when the text would change meaning', () => {
    expect(encodeYamlScalar('true', 'yes please', 'string')).toBe('"true"');
    expect(encodeYamlScalar('a: b', 'x', 'string')).toBe('"a: b"');
    expect(encodeYamlScalar('run # now', 'x', 'string')).toBe('"run # now"');
    expect(encodeYamlScalar('', 'x', 'string')).toBe('""');
  });

  test('keeps the original quote style', () => {
    expect(encodeYamlScalar('it\'s', "'old'", 'string')).toBe("'it''s'");
    expect(encodeYamlScalar('new', '"old"', 'string')).toBe('"new"');
  });
});

describe('XML', () => {
  test('escapes text and attribute values', () => {
    expect(encodeXmlText('a < b & c')).toBe('a &lt; b &amp; c');
    expect(encodeXmlAttributeValue('say "hi"', '"')).toBe('say &quot;hi&quot;');
    expect(encodeXmlAttributeValue("it's", "'")).toBe('it&apos;s');
  });
});

test('skips edits that change nothing', () => {
  expect(createReplacement('a: 1', { from: 3, to: 4 }, '1')).toBeNull();
  expect(createReplacement('a: 1', { from: 3, to: 4 }, '2')).toEqual({ from: 3, to: 4, insert: '2' });
});
