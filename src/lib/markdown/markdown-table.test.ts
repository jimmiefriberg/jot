import { expect, test } from 'bun:test';

import { cellAtOffset, deleteColumn, deleteRow, formatTable, insertColumn, insertRow, offsetOfCell, parseTable } from './markdown-table';

const SOURCE = `| Tool | Use | Cost |
| :--- | :-: | ---: |
| Jot | Notes | $0 |
| Spreadsheet | Numbers |`;

test('lines up columns, keeping each column’s alignment', () => {
  expect(formatTable(parseTable(SOURCE))).toBe(
    [
      '| Tool        |   Use   | Cost |',
      '| :---------- | :-----: | ---: |',
      '| Jot         |  Notes  |   $0 |',
      '| Spreadsheet | Numbers |      |',
    ].join('\n'),
  );
});

test('reads tables without outer pipes and keeps escaped pipes inside cells', () => {
  const table = parseTable('a | b\n--- | ---\nx \\| y | z');
  expect(table.rows).toEqual([
    ['a', 'b'],
    ['x \\| y', 'z'],
  ]);
});

test('inserts and deletes rows, but never the header', () => {
  const table = parseTable(SOURCE);
  expect(insertRow(table, 2).rows[2]).toEqual(['', '', '']);
  expect(insertRow(table, 0).rows[1]).toEqual(['', '', '']);
  expect(deleteRow(table, 1).rows.map((row) => row[0])).toEqual(['Tool', 'Spreadsheet']);
  expect(deleteRow(table, 0)).toBe(table);
});

test('inserts and deletes columns, but never the last one', () => {
  const table = parseTable(SOURCE);
  const withColumn = insertColumn(table, 1);
  expect(withColumn.rows[0]).toEqual(['Tool', '', 'Use', 'Cost']);
  expect(withColumn.alignments).toEqual(['left', 'none', 'center', 'right']);
  expect(deleteColumn(table, 0).rows[0]).toEqual(['Use', 'Cost']);
  const single = parseTable('| a |\n| - |');
  expect(deleteColumn(single, 0)).toBe(single);
});

test('finds the cell at a position, and where a cell starts after formatting', () => {
  expect(cellAtOffset(SOURCE, SOURCE.indexOf('Notes'))).toEqual({ rowIndex: 1, columnIndex: 1 });
  expect(cellAtOffset(SOURCE, 2)).toEqual({ rowIndex: 0, columnIndex: 0 });
  const formatted = formatTable(parseTable(SOURCE));
  expect(formatted.slice(offsetOfCell(formatted, { rowIndex: 2, columnIndex: 1 })).startsWith('Numbers')).toBe(true);
  expect(formatted.slice(offsetOfCell(formatted, { rowIndex: 0, columnIndex: 0 })).startsWith('Tool')).toBe(true);
});

test('reads the shortest GitHub form, with no alignment colons', () => {
  expect(formatTable(parseTable('|a|b|\n|--|--|\n|1|2|'))).toBe('| a   | b   |\n| --- | --- |\n| 1   | 2   |');
});
