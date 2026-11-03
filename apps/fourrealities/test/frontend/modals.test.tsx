/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Tests for LinkDecisionModal and Confluence page search (B-41).
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, textOf } from './forge-mocks';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { DecisionModal, ExceptionModal, LinkDecisionModal, ReviewModal } from '../../src/frontend/modals';

describe('LinkDecisionModal with Confluence Search (B-41)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bridgeState.invoke.mockReset();
  });

  it('searches Confluence pages and allows selecting a result', async () => {
    bridgeState.invoke.mockImplementation((name: string) => {
      if (name === 'searchConfluencePages') {
        return Promise.resolve({
          ok: true,
          pages: [
            {
              title: 'ADR-001 Evidence Model',
              url: 'https://asymmsystems.atlassian.net/wiki/spaces/ARCH/pages/1001',
              spaceKey: 'ARCH'
            }
          ]
        });
      }
      if (name === 'linkDecision') {
        return Promise.resolve({
          success: true,
          row: { issueKey: 'DEMO-10', gates: { intent: { state: 'FOUND' } } }
        });
      }
      return Promise.resolve({});
    });

    let doneRow: unknown = null;
    let closed = false;

    const root = TestRenderer.create(
      <LinkDecisionModal
        issueId="10010"
        issueKey="DEMO-10"
        onClose={() => { closed = true; }}
        onDone={(r) => { doneRow = r; }}
      />
    );

    // Initial state: shows manual fields and Search Confluence button
    expect(textOf(root.toJSON())).toContain('Search Confluence...');
    expect(textOf(root.toJSON())).toContain('Page address');

    // Click to expand search
    await act(async () => {
      findButton(root.root, 'Search Confluence...').props.onClick();
    });

    expect(textOf(root.toJSON())).toContain('Hide Confluence search');

    // Type query into search field
    const searchInput = findAll(root.root, 'Textfield', p => p.id === 'fr-link-search')[0];
    await act(async () => {
      searchInput.props.onChange({ target: { value: 'ADR' } });
    });

    // Click Search
    const searchBtn = findButton(root.root, 'Search');
    await act(async () => {
      searchBtn.props.onClick();
    });

    // Result is displayed
    expect(textOf(root.toJSON())).toContain('ADR-001 Evidence Model');
    expect(textOf(root.toJSON())).toContain('ARCH');

    // Select the search result
    const selectBtn = findButton(root.root, 'Select');
    await act(async () => {
      selectBtn.props.onClick();
    });

    // Selected page note box appears and manual fields are hidden
    expect(textOf(root.toJSON())).toContain('Selected page:');
    expect(textOf(root.toJSON())).toContain('ADR-001 Evidence Model');

    // Click Add link
    const addBtn = findButton(root.root, 'Add link');
    await act(async () => {
      addBtn.props.onClick();
    });

    expect(bridgeState.invoke).toHaveBeenCalledWith('linkDecision', {
      issueId: '10010',
      issueKey: 'DEMO-10',
      url: 'https://asymmsystems.atlassian.net/wiki/spaces/ARCH/pages/1001',
      title: 'ADR-001 Evidence Model'
    });
    expect(doneRow).not.toBeNull();
    expect(closed).toBe(false);
  });

  it('displays notice when no Confluence pages match search', async () => {
    bridgeState.invoke.mockImplementationOnce((name: string) => {
      if (name === 'searchConfluencePages') {
        return Promise.resolve({ ok: true, pages: [] });
      }
      return Promise.resolve({});
    });

    const root = TestRenderer.create(
      <LinkDecisionModal
        issueId="10011"
        issueKey="DEMO-11"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );

    await act(async () => {
      findButton(root.root, 'Search Confluence...').props.onClick();
    });

    const searchInput = findAll(root.root, 'Textfield', p => p.id === 'fr-link-search')[0];
    await act(async () => {
      searchInput.props.onChange({ target: { value: 'Nonexistent' } });
    });

    const searchBtn = findButton(root.root, 'Search');
    await act(async () => {
      searchBtn.props.onClick();
    });

    expect(textOf(root.toJSON())).toContain('No Confluence pages found matching your search.');
  });

  it('handles search error response from backend', async () => {
    bridgeState.invoke.mockResolvedValueOnce({
      ok: false,
      error: 'Permission denied to search Confluence.'
    });

    const root = TestRenderer.create(
      <LinkDecisionModal
        issueId="10013"
        issueKey="DEMO-13"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );

    await act(async () => {
      findButton(root.root, 'Search Confluence...').props.onClick();
    });

    const searchInput = findAll(root.root, 'Textfield', p => p.id === 'fr-link-search')[0];
    await act(async () => {
      searchInput.props.onChange({ target: { value: 'ADR' } });
    });

    await act(async () => {
      findButton(root.root, 'Search').props.onClick();
    });

    expect(textOf(root.toJSON())).toContain('Permission denied to search Confluence.');
  });

  it('handles search exception thrown by bridge', async () => {
    bridgeState.invoke.mockRejectedValueOnce(new Error('Confluence offline'));

    const root = TestRenderer.create(
      <LinkDecisionModal
        issueId="10014"
        issueKey="DEMO-14"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );

    await act(async () => {
      findButton(root.root, 'Search Confluence...').props.onClick();
    });

    const searchInput = findAll(root.root, 'Textfield', p => p.id === 'fr-link-search')[0];
    await act(async () => {
      searchInput.props.onChange({ target: { value: 'ADR' } });
    });

    await act(async () => {
      findButton(root.root, 'Search').props.onClick();
    });

    expect(textOf(root.toJSON())).toContain('Confluence offline');
  });

  it('allows clearing a selected page to return to manual fields', async () => {
    bridgeState.invoke.mockResolvedValueOnce({
      ok: true,
      pages: [
        {
          title: 'ADR-002 Volatility Layering',
          url: 'https://asymmsystems.atlassian.net/wiki/spaces/ARCH/pages/1002'
        }
      ]
    });

    const root = TestRenderer.create(
      <LinkDecisionModal
        issueId="10012"
        issueKey="DEMO-12"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );

    await act(async () => {
      findButton(root.root, 'Search Confluence...').props.onClick();
    });

    const searchInput = findAll(root.root, 'Textfield', p => p.id === 'fr-link-search')[0];
    await act(async () => {
      searchInput.props.onChange({ target: { value: 'ADR-002' } });
    });

    await act(async () => {
      findButton(root.root, 'Search').props.onClick();
    });

    await act(async () => {
      findButton(root.root, 'Select').props.onClick();
    });

    expect(textOf(root.toJSON())).toContain('Selected page:');
    expect(textOf(root.toJSON())).toContain('ADR-002 Volatility Layering');

    // Click Clear
    await act(async () => {
      findButton(root.root, 'Clear').props.onClick();
    });

    // Manual fields are restored
    expect(textOf(root.toJSON())).toContain('Page address');
    expect(textOf(root.toJSON())).not.toContain('Selected page:');
  });

  it('renders ExceptionModal and submits CODE and REWORK exceptions', async () => {
    bridgeState.invoke.mockResolvedValue({ success: true, row: { issueKey: 'DEMO-20' } });

    let done = false;
    const rootCode = TestRenderer.create(
      <ExceptionModal
        issueId="10020"
        issueKey="DEMO-20"
        type="CODE"
        onClose={() => undefined}
        onDone={() => { done = true; }}
      />
    );

    expect(textOf(rootCode.toJSON())).toContain('Request a Code exception');
    const reasonCode = findAll(rootCode.root, 'Textfield', p => p.id === 'fr-exception-reason')[0];
    await act(async () => { reasonCode.props.onChange({ target: { value: 'No PR for docs only' } }); });
    await act(async () => { findButton(rootCode.root, 'Save exception').props.onClick(); });
    expect(done).toBe(true);

    const rootRework = TestRenderer.create(
      <ExceptionModal
        issueId="10021"
        issueKey="DEMO-21"
        type="REWORK"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );
    expect(textOf(rootRework.toJSON())).toContain('Record a rework reason');
  });

  it('renders DecisionModal for APPROVE, REJECT, and REVOKE', async () => {
    bridgeState.invoke.mockResolvedValue({ success: true, row: { issueKey: 'DEMO-30' } });

    const rootApprove = TestRenderer.create(
      <DecisionModal
        issueId="10030"
        issueKey="DEMO-30"
        decision="APPROVE"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );
    expect(textOf(rootApprove.toJSON())).toContain('Approve the Code exception for DEMO-30');

    const rootReject = TestRenderer.create(
      <DecisionModal
        issueId="10031"
        issueKey="DEMO-31"
        decision="REJECT"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );
    expect(textOf(rootReject.toJSON())).toContain('Reject the Code exception for DEMO-31');

    const rootRevoke = TestRenderer.create(
      <DecisionModal
        issueId="10032"
        issueKey="DEMO-32"
        decision="REVOKE"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    );
    expect(textOf(rootRevoke.toJSON())).toContain('Revoke the Code exception for DEMO-32');
  });

  it('renders ReviewModal and submits review request comment', async () => {
    bridgeState.invoke.mockResolvedValue({ success: true });

    let reviewed = false;
    const root = TestRenderer.create(
      <ReviewModal
        issueId="10040"
        issueKey="DEMO-40"
        onClose={() => undefined}
        onDone={() => { reviewed = true; }}
      />
    );

    expect(textOf(root.toJSON())).toContain('Request retrospective review');
    const commentField = findAll(root.root, 'Textfield', p => p.id === 'fr-review-comment')[0];
    await act(async () => { commentField.props.onChange({ target: { value: 'Please review retrospective logs' } }); });
    await act(async () => { findButton(root.root, 'Request review').props.onClick(); });
    expect(reviewed).toBe(true);
  });
});
