/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-016: what the panel form and the admin page tabs show for code signing.
 *
 * @author Fahim Farook
 */

import { DECLARATION, DECLARATION_V2 } from '../src/domain/declaration';
import { buildAlertRows, buildSigningAdminView, buildSigningForm, parseProjectKeys } from '../src/frontend/signing-view-model';

const none = { challengeId: null, expiresAt: null, code: '' };
const V2 = { version: '2', text: DECLARATION_V2.text };

describe('panel form', () => {
  it('needs no code and shows declaration 1 outside code-signing projects (and for old responses)', () => {
    expect(buildSigningForm({}, none)).toEqual({ needsCode: false, declaration: { version: '1', text: DECLARATION.text }, blockedText: null, sentText: null, canSubmit: true });
    expect(buildSigningForm({ part11: { on: false, declaration: { version: '1', text: DECLARATION.text } } }, none).needsCode).toBe(false);
  });

  it('blocks the form for a pending declaration or an invalid policy', () => {
    expect(buildSigningForm({ part11: { on: true, pending: true, declaration: V2 } }, none)).toMatchObject({ canSubmit: false, blockedText: expect.stringContaining('waiting for approval') });
    expect(buildSigningForm({ part11: { on: true, invalid: true, declaration: V2 } }, none)).toMatchObject({ canSubmit: false, blockedText: expect.stringContaining('integrity check') });
  });

  it('allows submit only after a code was sent and 6 digits were typed', () => {
    const on = { part11: { on: true, pending: false, invalid: false, declaration: V2 } };
    expect(buildSigningForm(on, none)).toMatchObject({ needsCode: true, canSubmit: false, sentText: null, declaration: V2 });
    const sent = { challengeId: 'c', expiresAt: '2026-11-08T10:05:00.000Z', code: '12345' };
    expect(buildSigningForm(on, sent)).toMatchObject({ canSubmit: false, sentText: expect.stringContaining('It works once') });
    expect(buildSigningForm(on, { ...sent, code: ' 123 456 ' }).canSubmit).toBe(true);
    expect(buildSigningForm(on, { ...sent, code: '123-456' }).canSubmit).toBe(true);
  });
});

describe('admin tabs', () => {
  it('maps loading, failure and refusal', () => {
    expect(buildSigningAdminView(true, null).state).toBe('LOADING');
    expect(buildSigningAdminView(false, null).state).toBe('ERROR');
    expect(buildSigningAdminView(false, { ok: false, code: 'NOT_ADMIN', message: 'no' })).toMatchObject({ state: 'NOT_ADMIN', message: 'no' });
    expect(buildSigningAdminView(false, { ok: false, code: 'JIRA_UNREACHABLE', message: 'x' }).state).toBe('ERROR');
  });

  it('says why code signing cannot be turned on while the declaration is pending', () => {
    const v = buildSigningAdminView(false, { ok: true, policy: null, policyValid: true, projects: [], declaration: { text: 'T', approved: false }, lockoutDefault: 5 });
    expect(v).toMatchObject({ state: 'READY', enabled: false, lockout: '5', declarationPending: true, declarationText: 'T', policyNote: 'Not set up. Code signing is off.' });
    expect(v.message).toContain('waiting for the owner');
  });

  it('shows the saved policy, its projects, and an integrity failure', () => {
    const policy = { version: 2, enabled: true, lockoutThreshold: 4, fromDate: '2026-11-08T10:00:00.000Z' };
    const v = buildSigningAdminView(false, { ok: true, policy, policyValid: true, projects: [{ key: 'OPS' }, { key: 'CHG' }], declaration: { text: 'T', approved: true } });
    expect(v).toMatchObject({ enabled: true, projectKeys: 'CHG, OPS', lockout: '4', declarationPending: false });
    expect(v.policyNote).toMatch(/^Version 2, saved .*\. On\.$/);
    expect(v.message).toContain('single-use code');
    expect(buildSigningAdminView(false, { ok: true, policy: { ...policy, enabled: false }, policyValid: true, declaration: { approved: true } }).policyNote).toMatch(/Off\.$/);
    expect(buildSigningAdminView(false, { ok: true, policy, policyValid: false, declaration: {} }).policyNote).toContain('integrity check');
  });

  it('parses project keys', () => {
    expect(parseProjectKeys(' chg, OPS;ops  pay ')).toEqual(['CHG', 'OPS', 'PAY']);
    expect(parseProjectKeys('')).toEqual([]);
    expect(parseProjectKeys(undefined as any)).toEqual([]);
  });

  it('builds alert rows with a title and detail', () => {
    const rows = buildAlertRows({ alerts: [{ seq: 3, kind: 'LOCKED', at: '2026-11-08T10:00:00.000Z', accountId: 'a', issueId: '10001', action: 'SEAL', reason: '5 failed attempts in a row' }, { seq: 2, kind: 'NEW_KIND', at: null }] });
    expect(rows[0]).toMatchObject({ seq: 3, title: 'Locked out after failed attempts', accountId: 'a', detail: 'issue 10001, action SEAL, 5 failed attempts in a row' });
    expect(rows[1]).toMatchObject({ title: 'NEW_KIND', accountId: '', detail: '' });
    expect(buildAlertRows(null)).toEqual([]);
  });
});
