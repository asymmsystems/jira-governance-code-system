/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: progress and Jira status rules (owner decision 2026-11-06, INV-03).
 */

import {
  statusOffers, offerPrompt, progressLockReason, progressText, shownProgress, statusLabel, isDone
} from '../../src/ui/progress-status';

describe('statusOffers', () => {
  it('offers In Progress when a To Do item gets progress above 0%', () => {
    expect(statusOffers([{ key: 'PAY-12', status: 'NOT_STARTED', progress: 30 }]))
      .toEqual([{ key: 'PAY-12', from: 'NOT_STARTED', to: 'IN_PROGRESS' }]);
  });

  it('offers Done when an item that is not Done reaches 100%', () => {
    expect(statusOffers([{ key: 'PAY-1', status: 'IN_PROGRESS', progress: 100 }]))
      .toEqual([{ key: 'PAY-1', from: 'IN_PROGRESS', to: 'COMPLETED' }]);
    expect(statusOffers([{ key: 'PAY-2', status: 'NOT_STARTED', progress: 100 }]))
      .toEqual([{ key: 'PAY-2', from: 'NOT_STARTED', to: 'COMPLETED' }]);
  });

  it('offers nothing for 0%, for an In Progress item below 100%, or for a Done item', () => {
    expect(statusOffers([
      { key: 'A-1', status: 'IN_PROGRESS', progress: 0 },
      { key: 'A-2', status: 'NOT_STARTED', progress: 0 },
      { key: 'A-3', status: 'IN_PROGRESS', progress: 60 },
      { key: 'A-4', status: 'COMPLETED', progress: 40 }
    ])).toEqual([]);
  });

  it('offers nothing when the user already chose a status in the same action (INV-03)', () => {
    expect(statusOffers([{ key: 'A-1', status: 'NOT_STARTED', progress: 50, chosenStatus: 'NOT_STARTED' }])).toEqual([]);
    expect(statusOffers([{ key: 'A-2', status: 'IN_PROGRESS', progress: 100, chosenStatus: 'IN_PROGRESS' }])).toEqual([]);
  });

  it('treats an unknown status as To Do and ignores a progress that is not a number', () => {
    expect(statusOffers([{ key: 'A-1', progress: 10 }])).toEqual([{ key: 'A-1', from: 'NOT_STARTED', to: 'IN_PROGRESS' }]);
    expect(statusOffers([{ key: 'A-2', status: 'NOT_STARTED', progress: Number.NaN }])).toEqual([]);
  });

  it('keeps the order of a batch', () => {
    const offers = statusOffers([
      { key: 'A-1', status: 'NOT_STARTED', progress: 20 },
      { key: 'A-2', status: 'IN_PROGRESS', progress: 50 },
      { key: 'A-3', status: 'IN_PROGRESS', progress: 100 }
    ]);
    expect(offers.map(o => o.key)).toEqual(['A-1', 'A-3']);
  });
});

describe('offerPrompt', () => {
  it('names the item and both choices for one offer', () => {
    expect(offerPrompt([{ key: 'PAY-12', from: 'NOT_STARTED', to: 'IN_PROGRESS' }])).toEqual({
      question: 'PAY-12 is To Do in Jira. Also move it to In Progress?',
      lines: [],
      move: 'Move to In Progress',
      keep: 'Keep To Do'
    });
    expect(offerPrompt([{ key: 'PAY-3', from: 'IN_PROGRESS', to: 'COMPLETED' }])!.question)
      .toBe('PAY-3 is In Progress in Jira. Also move it to Done?');
  });

  it('lists every item for several offers', () => {
    const p = offerPrompt([
      { key: 'A-1', from: 'NOT_STARTED', to: 'IN_PROGRESS' },
      { key: 'A-3', from: 'IN_PROGRESS', to: 'COMPLETED' }
    ])!;
    expect(p.question).toBe('The new progress does not match the Jira status of 2 work items. Also change their status in Jira?');
    expect(p.lines).toEqual(['A-1: To Do to In Progress', 'A-3: In Progress to Done']);
    expect(p.move).toBe('Change the statuses');
    expect(p.keep).toBe('Keep the statuses');
  });

  it('returns null when there is nothing to ask', () => {
    expect(offerPrompt([])).toBeNull();
  });
});

describe('locked progress and its text', () => {
  it('locks the progress of a Done item with a reason', () => {
    expect(progressLockReason({ key: 'PAY-9', status: 'COMPLETED' }))
      .toBe('PAY-9 is Done in Jira, so its progress is 100%. Change its status to reopen it.');
    expect(progressLockReason({ key: 'PAY-9', status: 'IN_PROGRESS' })).toBeNull();
  });

  it('says when 100% is not Done in Jira', () => {
    expect(progressText({ progress: 100, status: 'IN_PROGRESS' })).toBe('100%, not Done in Jira');
    expect(progressText({ progress: 100, status: 'COMPLETED' })).toBe('100%');
    expect(progressText({ progress: 42.4, status: 'IN_PROGRESS' })).toBe('42%');
    expect(progressText({})).toBe('0%');
  });

  it('shows 100% for Done and keeps a manual value for when the item is reopened', () => {
    expect(shownProgress('COMPLETED', 60, 30)).toBe(100);
    expect(shownProgress('IN_PROGRESS', 60, 30)).toBe(60);
    expect(shownProgress('IN_PROGRESS', undefined, 30)).toBe(30);
  });

  it('names the status categories', () => {
    expect(statusLabel('NOT_STARTED')).toBe('To Do');
    expect(statusLabel('IN_PROGRESS')).toBe('In Progress');
    expect(statusLabel('COMPLETED')).toBe('Done');
    expect(statusLabel(undefined)).toBe('To Do');
    expect(isDone('COMPLETED')).toBe(true);
    expect(isDone('IN_PROGRESS')).toBe(false);
  });
});
