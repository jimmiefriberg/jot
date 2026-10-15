import { describe, expect, test } from 'bun:test';

import {
  canMoveRange,
  columnLabel,
  deleteColumns,
  detectNumericColumns,
  filterRowIndexes,
  insertColumn,
  insertRow,
  isNumericCell,
  moveColumns,
  moveRows,
  parseClipboardRegion,
  parseCsv,
  pasteRegion,
  serializeCsv,
  serializeRegion,
  setCell,
  sortRows,
} from './csv-model';

describe('parseCsv / serializeCsv', () => {
  test('round-trips quoted cells, delimiter and trailing newline', () => {
    const text = 'name,note\n"Smith, Jane","said ""hi"""\nBob,\n';
    const csv = parseCsv(text);
    expect(csv.rows).toEqual([
      ['name', 'note'],
      ['Smith, Jane', 'said "hi"'],
      ['Bob', ''],
    ]);
    expect(serializeCsv(csv)).toBe(text);
  });

  test('detects tabs and CRLF line endings', () => {
    const csv = parseCsv('a\tb\r\n1\t2');
    expect(csv.delimiter).toBe('\t');
    expect(csv.newline).toBe('\r\n');
    expect(serializeCsv(moveRows(csv, { start: 1, end: 1 }, -1))).toBe('1\t2\r\na\tb');
  });

  test('keeps multi-line cells intact', () => {
    const csv = parseCsv('a,"line one\nline two"\n');
    expect(csv.rows[0][1]).toBe('line one\nline two');
  });

  test('handles an empty file', () => {
    expect(serializeCsv(parseCsv(''))).toBe('');
  });
});

describe('moving', () => {
  const csv = parseCsv('h1,h2,h3\na,b,c\nd,e,f\ng,h,i');

  test('moves a block of rows down', () => {
    const moved = moveRows(csv, { start: 1, end: 2 }, 1);
    expect(moved.rows.map((row) => row[0])).toEqual(['h1', 'g', 'a', 'd']);
  });

  test('moves a column left in every row', () => {
    const moved = moveColumns(csv, { start: 2, end: 2 }, -2);
    expect(moved.rows[0]).toEqual(['h3', 'h1', 'h2']);
    expect(moved.rows[3]).toEqual(['i', 'g', 'h']);
  });

  test('canMoveRange respects bounds and a header row', () => {
    expect(canMoveRange({ start: 1, end: 1 }, -1, 4, 1)).toBe(false);
    expect(canMoveRange({ start: 2, end: 3 }, -1, 4, 1)).toBe(true);
    expect(canMoveRange({ start: 2, end: 3 }, 1, 4)).toBe(false);
  });
});

describe('editing', () => {
  test('pads ragged rows when inserting a column', () => {
    const csv = insertColumn(parseCsv('a,b\nc'), 1);
    expect(csv.rows).toEqual([
      ['a', '', 'b'],
      ['c', '', ''],
    ]);
  });

  test('inserts an empty row with the full width', () => {
    expect(insertRow(parseCsv('a,b'), 0).rows).toEqual([
      ['', ''],
      ['a', 'b'],
    ]);
  });

  test('sets a cell and deletes columns', () => {
    const edited = deleteColumns(setCell(parseCsv('a,b,c'), 0, 1, 'x'), { start: 2, end: 2 });
    expect(edited.rows).toEqual([['a', 'x']]);
  });

  test('editing a cell leaves other ragged rows as they were', () => {
    const text = 'a,b,c\nd\ne,f\n';
    expect(serializeCsv(setCell(parseCsv(text), 1, 0, 'x'))).toBe('a,b,c\nx\ne,f\n');
  });

  test('serializes a region for the clipboard', () => {
    const csv = parseCsv('a,b,c\nd,e,f');
    expect(serializeRegion(csv, { start: 0, end: 1 }, { start: 1, end: 1 })).toBe('b\ne');
  });
});

test('columnLabel works like a spreadsheet', () => {
  expect([0, 25, 26, 27, 701].map(columnLabel)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']);
});

test('pastes a region, growing the table when needed', () => {
  const csv = pasteRegion(parseCsv('a,b\nc,d'), 1, 1, parseClipboardRegion('x\ty\nz\tw\n', ','));
  expect(csv.rows).toEqual([
    ['a', 'b', ''],
    ['c', 'x', 'y'],
    ['', 'z', 'w'],
  ]);
});

const people = parseCsv('name,age,city\nGrace,85,\nada,36,London\nAlan,41,Wilmslow\nZed,9,Paris\n');

test('sorts rows by a column below the header, numbers by value and empty cells last', () => {
  expect(sortRows(people, 1, 'ascending', 1).rows.map((row) => row[1])).toEqual(['age', '9', '36', '41', '85']);
  expect(sortRows(people, 0, 'descending', 1).rows.map((row) => row[0])).toEqual(['name', 'Zed', 'Grace', 'Alan', 'ada']);
  expect(sortRows(people, 2, 'descending', 1).rows.map((row) => row[2])).toEqual(['city', 'Wilmslow', 'Paris', 'London', '']);
});

test('filters rows by any cell, ignoring case', () => {
  expect(filterRowIndexes(people, 'LON', 1)).toEqual([2]);
  expect(filterRowIndexes(people, '', 1)).toEqual([1, 2, 3, 4]);
});

test('detects numeric columns', () => {
  expect([...detectNumericColumns(people, 1)]).toEqual([1]);
  expect(isNumericCell('$1,250.50')).toBe(true);
  expect(isNumericCell('12%')).toBe(true);
  expect(isNumericCell('v2')).toBe(false);
});
