/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the explicit browser save of a downloaded report file (live check of 7.7.0, 2026-11-08:
 * FileCard did not save a returned Blob), and the refresh timing of the reports list.
 */

import { saveBlob } from '../../src/ui/save-file';
import { notReadBadge, notReadNotice, notReadRange, pollDelayMs, refusalLine } from '../../src/ui/report-text';

describe('saveBlob', () => {
  it('saves the Blob under the file name with an object URL and a clicked anchor, then cleans up', () => {
    const anchor = { href: '', download: '', style: { display: '' }, click: jest.fn(), remove: jest.fn() };
    const body = { appendChild: jest.fn() };
    const url = { createObjectURL: jest.fn(() => 'blob:x'), revokeObjectURL: jest.fn() };
    const later: Array<() => void> = [];
    const blob = { size: 3 } as unknown as Blob;
    expect(saveBlob(blob, 'fourrealities-PAY-2026-01-01-2026-11-08-18520860.json', { document: { createElement: () => anchor, body }, url, later: fn => { later.push(fn); } })).toBe(true);
    expect(url.createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor).toMatchObject({ href: 'blob:x', download: 'fourrealities-PAY-2026-01-01-2026-11-08-18520860.json', style: { display: 'none' } });
    expect(body.appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    later[0]();
    expect(anchor.remove).toHaveBeenCalled();
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('reports false when the runtime has no document or no object URLs, so the caller returns the Blob', () => {
    expect(saveBlob({} as Blob, 'f', {})).toBe(false);
    expect(saveBlob({} as Blob, 'f', { document: { createElement: jest.fn() as never }, url: {} })).toBe(false);
    expect(saveBlob({} as Blob, 'f')).toBe(typeof document !== 'undefined');
  });

  it('uses a real timer when none is given', () => {
    jest.useFakeTimers();
    const anchor = { href: '', download: '', style: { display: '' }, click: jest.fn(), remove: jest.fn() };
    saveBlob({} as Blob, 'f', { document: { createElement: () => anchor, body: { appendChild: jest.fn() } }, url: { createObjectURL: () => 'u' } });
    jest.advanceTimersByTime(1000);
    expect(anchor.remove).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('list refresh and schedule refusal words', () => {
  it('waits 5, 10, 20, 40, then 60 s, and stops after 40 refreshes', () => {
    expect([0, 1, 2, 3, 4, 10, 39].map(pollDelayMs)).toEqual([5000, 10000, 20000, 40000, 60000, 60000, 60000]);
    expect(pollDelayMs(40)).toBeNull();
  });
  it('says why a scheduled period is not made yet', () => {
    expect(refusalLine({ message: 'Jira did not answer.', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' } }))
      .toBe('The report for 1 Oct 2026 to 31 Oct 2026 is not made yet: Jira did not answer. FourRealities tries again on its next daily run.');
  });
});

describe('not-read words (review N-1)', () => {
  it('counts the issues that are not in a report', () => {
    expect([notReadBadge(undefined), notReadBadge(0), notReadBadge(1), notReadBadge(4)]).toEqual([null, null, '1 issue not in report', '4 issues not in report']);
    expect(notReadNotice(1)).toContain('1 issue of the scope is not in this report');
    expect(notReadNotice(2)).toContain('2 issues of the scope are not in this report');
    expect(notReadRange({ page: 0, pageSize: 50, total: 51 })).toBe('Issues 1 to 50 of 51');
    expect(notReadRange({ page: 1, pageSize: 50, total: 51 })).toBe('Issues 51 to 51 of 51');
  });
});

