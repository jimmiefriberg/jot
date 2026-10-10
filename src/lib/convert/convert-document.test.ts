import { expect, test } from 'bun:test';

import { convertDocument } from './convert-document';

const options = { tabSize: 2, isFirstRowHeader: true };

test('turns a JSON list of objects into a CSV table', () => {
  const json = '[{ "name": "Ada", "tags": ["math"] }, { "name": "Grace", "year": 1906 }] // people';
  const result = convertDocument(json, 'json', 'csv', options);
  expect(result).toEqual({ isOk: true, value: 'name,tags,year\nAda,"[""math""]",\nGrace,,1906\n' });
});

test('turns a CSV table into JSON objects using the header row', () => {
  const result = convertDocument('name,role\nAda,Mathematician\n', 'csv', 'json', options);
  expect(result.isOk && JSON.parse(result.value)).toEqual([{ name: 'Ada', role: 'Mathematician' }]);
});

test('converts between JSON and YAML', () => {
  const yaml = convertDocument('{ "jobs": { "build": { "steps": [1, 2] } } }', 'json', 'yaml', options);
  expect(yaml).toEqual({ isOk: true, value: 'jobs:\n  build:\n    steps:\n      - 1\n      - 2\n' });
  const json = convertDocument('a: 1\n---\nb: 2\n', 'yaml', 'json', options);
  expect(json.isOk && JSON.parse(json.value)).toEqual([{ a: 1 }, { b: 2 }]);
});

test('explains what went wrong instead of converting', () => {
  expect(convertDocument('{ "a": }', 'json', 'yaml', options).isOk).toBe(false);
  const notATable = convertDocument('{ "a": 1 }', 'json', 'csv', options);
  expect(notATable.isOk ? '' : notATable.error).toContain('Only a list');
});
