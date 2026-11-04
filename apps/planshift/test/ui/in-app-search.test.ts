/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: in-app task search matching and navigation (pure; B-26).
 */

import {
  matchTask,
  findMatchingTasks,
  findNextMatch,
  formatMatchCount,
  isSearchShortcut
} from '../../src/ui/in-app-search';

describe('in-app search (B-26 criterion 3)', () => {
  const sampleTasks = [
    { key: 'SYN-1', summary: 'Database Schema' },
    { key: 'SYN-2', summary: 'API Service' },
    { key: 'SYN-3', summary: 'Integration Testing' },
    { key: 'PROJ-10', summary: 'Fix database connection pool' },
    { key: 'NO-SUMMARY' },
    { summary: 'Keyless Task' }
  ];

  it('matches tasks by key or summary case-insensitively', () => {
    expect(matchTask(sampleTasks[0], 'syn-1')).toBe(true);
    expect(matchTask(sampleTasks[0], 'SYN')).toBe(true);
    expect(matchTask(sampleTasks[0], 'database')).toBe(true);
    expect(matchTask(sampleTasks[0], 'SCHEMA')).toBe(true);
    expect(matchTask(sampleTasks[0], 'nonexistent')).toBe(false);
    expect(matchTask(sampleTasks[0], '')).toBe(false);
    expect(matchTask(sampleTasks[0], '   ')).toBe(false);

    expect(matchTask(sampleTasks[4], 'NO-SUMMARY')).toBe(true);
    expect(matchTask(sampleTasks[4], 'missing')).toBe(false);
    expect(matchTask(sampleTasks[5], 'Keyless')).toBe(true);
    expect(matchTask(sampleTasks[5], 'missing')).toBe(false);
  });

  it('finds matching tasks and their row indices in order', () => {
    const matches = findMatchingTasks(sampleTasks, 'database');
    expect(matches).toEqual([
      { task: sampleTasks[0], index: 0 },
      { task: sampleTasks[3], index: 3 }
    ]);

    expect(findMatchingTasks(sampleTasks, 'API')).toEqual([
      { task: sampleTasks[1], index: 1 }
    ]);

    expect(findMatchingTasks(sampleTasks, 'XYZ')).toEqual([]);
    expect(findMatchingTasks(sampleTasks, '')).toEqual([]);
    expect(findMatchingTasks(sampleTasks, '   ')).toEqual([]);
  });

  it('navigates next and previous matches with wrap-around', () => {
    const indices = [0, 2, 5];
    expect(findNextMatch(indices, -1, 1)).toBe(0);
    expect(findNextMatch(indices, -1, -1)).toBe(2);
    expect(findNextMatch(indices, 0, 1)).toBe(1);
    expect(findNextMatch(indices, 1, 1)).toBe(2);
    expect(findNextMatch(indices, 2, 1)).toBe(0); // wraps forward

    expect(findNextMatch(indices, 0, -1)).toBe(2); // wraps backward
    expect(findNextMatch(indices, 2, -1)).toBe(1);
    expect(findNextMatch(indices, 1, -1)).toBe(0);

    expect(findNextMatch([], 0, 1)).toBe(-1);
    expect(findNextMatch([4], 0, 1)).toBe(0);
  });

  it('formats match count indicator for users', () => {
    expect(formatMatchCount('', 0, -1)).toBe('');
    expect(formatMatchCount('   ', 0, -1)).toBe('');
    expect(formatMatchCount('abc', 0, -1)).toBe('No matches');
    expect(formatMatchCount('abc', 1, 0)).toBe('1 of 1');
    expect(formatMatchCount('abc', 5, 2)).toBe('3 of 5');
    expect(formatMatchCount('abc', 5, -1)).toBe('1 of 5');
  });

  it('detects search shortcut Ctrl+F or Cmd+F only without Alt', () => {
    expect(isSearchShortcut({ key: 'f', ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ key: 'F', ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ key: 'f', metaKey: true })).toBe(true);
    expect(isSearchShortcut({ key: 'F', metaKey: true })).toBe(true);
    expect(isSearchShortcut({ key: 'f', ctrlKey: true, altKey: true })).toBe(false);
    expect(isSearchShortcut({ key: 'z', ctrlKey: true })).toBe(false);
    expect(isSearchShortcut({ key: 'f', shiftKey: true })).toBe(false);
  });

  it('handles empty, whitespace-only, and special characters cleanly', () => {
    expect(findMatchingTasks(sampleTasks, '   ')).toEqual([]);
    expect(findMatchingTasks([], 'test')).toEqual([]);
    expect(formatMatchCount('test', 0, -1)).toBe('No matches');
    expect(findNextMatch([0, 1], 0, 1)).toBe(1);
    expect(findNextMatch([0, 1], 1, 1)).toBe(0);
  });
});
