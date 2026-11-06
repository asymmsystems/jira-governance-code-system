/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  SectionMessage,
  Stack,
  Inline,
  Checkbox,
  Box,
  Spinner,
  User,
  RadioGroup,
  TextArea,
  CodeBlock,
  Heading
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { DECLARATION, MEANINGS } from '../domain/declaration';
import { buildPanelView, formatTime, historyLabel, PanelView } from './view-model';
import {
  ActionRow,
  AppSurface,
  AttributionLine,
  Card,
  FormField,
  KeyValueInline,
  ListRow,
  NoteBox,
  PanelHeader,
  Section,
  SPACE,
  SubSection,
  SummaryBlock,
  TEXT_ROLE
} from '@asymm/jira-ui';

type FormMode = 'seal' | 'approve' | 'revoke' | null;

/**
 * The LedgerSeal issue panel. Every decision about what to show comes from the view model (view-model.ts);
 * this component maps it to Asymm Systems In-Jira UI standard layout primitives and holds the form state.
 */
export const LedgerSealPanel: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [form, setForm] = useState<FormMode>(null);
  const [meaning, setMeaning] = useState<string>('APPROVAL');
  const [reason, setReason] = useState<string>('');
  const [declarationAgreed, setDeclarationAgreed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [showCovered, setShowCovered] = useState<boolean>(false);
  const [fullValues, setFullValues] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyNext, setHistoryNext] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const loadState = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setResult(await invoke('verify-issue-api', {}));
    } catch (err) {
      console.error('Failed to load seal state', err);
      // A failed load is an error state, never "not sealed" (LS-12)
      setLoadFailed(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const view: PanelView = buildPanelView({ loading, result, error: loadFailed });
  const sealReasonLabel = form === 'seal' ? view.actions.seal?.reasonLabel : undefined;
  const reasonNeeded = form === 'approve' || form === 'revoke' || Boolean(sealReasonLabel);
  const reasonMissing = reasonNeeded && reason.trim().length === 0;

  const openForm = (mode: FormMode) => {
    setForm(mode);
    setActionError(null);
    setReason('');
    setDeclarationAgreed(false);
  };

  const submit = async () => {
    if (reasonMissing || (form !== 'revoke' && !declarationAgreed)) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response =
        form === 'revoke'
          ? ((await invoke('revoke-seal-api', { reason: reason.trim() })) as { ok: boolean; message?: string } | undefined)
          : ((await invoke('seal-issue-api', {
              // F-05: the state this panel showed; the seal is refused when the issue changed since
              viewHash: result?.viewHash,
              signature: {
                meaning,
                declarationVersion: DECLARATION.version,
                declarationText: DECLARATION.text,
                reason: reasonNeeded ? reason.trim() : undefined
              }
            })) as { ok: boolean; message?: string } | undefined);
      if (!response?.ok) {
        setActionError(response?.message || 'LedgerSeal could not save this. Nothing was saved.');
        return;
      }
      setForm(null);
      setHistory(null);
      await loadState();
    } catch (err) {
      console.error('LedgerSeal action failed', err);
      setActionError('LedgerSeal could not save this. Nothing was saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // F-15: history in pages of 50, with who acted; a failed call says so instead of failing silently
  const loadHistoryPage = async (fromSeq: number, before: any[]) => {
    setHistoryError(null);
    try {
      const page = (await invoke('seal-history-api', { fromSeq })) as { entries?: any[]; nextFromSeq?: number | null } | undefined;
      setHistory([...before, ...(page?.entries ?? [])]);
      setHistoryNext(page?.nextFromSeq ?? null);
    } catch (err) {
      console.error('LedgerSeal: history failed', err);
      setHistoryError('LedgerSeal could not load the history. Try again.');
    }
  };

  const loadHistory = async () => {
    if (history) {
      setHistory(null);
      setHistoryNext(null);
      return;
    }
    await loadHistoryPage(1, []);
  };

  const loadEvidence = async () => {
    if (evidence) {
      setEvidence(null);
      return;
    }
    setEvidenceError(null);
    try {
      setEvidence(JSON.stringify(await invoke('seal-evidence-api', {}), null, 2));
    } catch (err) {
      console.error('LedgerSeal: evidence failed', err);
      setEvidenceError('LedgerSeal could not load the evidence record. Try again.');
    }
  };

  if (view.state === 'LOADING') {
    return (
      <AppSurface>
        <Inline alignBlock="center" space={SPACE.item}>
          <Spinner size="small" />
          <Text as="span">{view.title}</Text>
        </Inline>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      <PanelHeader
        title="LedgerSeal"
        statusText={view.lozenge?.text}
        statusAppearance={view.lozenge?.appearance}
        action={
          <Button appearance="default" spacing="compact" iconBefore="refresh" onClick={loadState}>
            Refresh
          </Button>
        }
      />

      <SummaryBlock>
        <Text as="span" weight="medium">{view.statusSentence}</Text>
        <KeyValueInline label="Next step:" value={view.nextStep} />

        {view.revokedByAccountId && (
          <AttributionLine prefix="Revoked by" accountId={view.revokedByAccountId} suffix="" />
        )}
        {view.revokedByClosed && (
          <Text as="span" size="small" color={TEXT_ROLE.secondary}>Revoked by a deleted user.</Text>
        )}

        {view.askText && (
          <NoteBox>
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>{view.askText}</Text>
          </NoteBox>
        )}

        {view.changes.length > 0 && (
          <Stack space={SPACE.group}>
            <Text as="span" weight="semibold">Changed items ({view.changes.length})</Text>
            {view.changes.map(row => (
              <ListRow key={row.fieldId} divided>
                <Stack space={SPACE.sub}>
                  <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
                    <Text as="span" weight="bold">{row.fieldName}</Text>
                    {row.detail && <Text as="span" color={TEXT_ROLE.secondary}>({row.detail})</Text>}
                  </Inline>
                  <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
                    <Text as="span" size="small" color={TEXT_ROLE.secondary} weight="medium">Was (at approval):</Text>
                    <Text as="span" size="small">{fullValues[row.fieldId] ? row.wasFull : row.was}</Text>
                  </Inline>
                  <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
                    <Text as="span" size="small" color={TEXT_ROLE.danger} weight="medium">Now (current edit):</Text>
                    <Text as="span" size="small">{fullValues[row.fieldId] ? row.nowFull : row.now}</Text>
                  </Inline>
                  <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
                    <Text as="span" size="small" color={TEXT_ROLE.muted}>Changed by:</Text>
                    {row.changedBy.map(id => <User key={id} accountId={id} />)}
                    {row.changedByClosed > 0 && (
                      <Text as="span" size="small" color={TEXT_ROLE.muted}>
                        {row.changedByClosed === 1 ? 'a deleted user' : `${row.changedByClosed} deleted users`}
                      </Text>
                    )}
                    {row.changedBy.length === 0 && row.changedByClosed === 0 && (
                      <Text as="span" size="small" color={TEXT_ROLE.muted}>unknown</Text>
                    )}
                    <Text as="span" size="small" color={TEXT_ROLE.muted}>on {row.changedAt}</Text>
                  </Inline>
                  {row.showFullToggle && (
                    <Box>
                      <Button
                        appearance="subtle"
                        spacing="compact"
                        onClick={() => setFullValues({ ...fullValues, [row.fieldId]: !fullValues[row.fieldId] })}
                      >
                        {fullValues[row.fieldId] ? 'Show less' : 'Show full value'}
                      </Button>
                    </Box>
                  )}
                </Stack>
              </ListRow>
            ))}
          </Stack>
        )}

        <ActionRow>
          {view.actions.retry && (
            <Button appearance="primary" onClick={() => loadState()}>
              {view.actions.retry.label}
            </Button>
          )}
          {view.actions.seal && (
            <Button appearance="primary" onClick={() => openForm('seal')}>
              {view.actions.seal.label}
            </Button>
          )}
          {view.actions.approveChanges && (
            <Button appearance="primary" onClick={() => openForm('approve')}>
              {view.actions.approveChanges.label}
            </Button>
          )}
          {view.actions.revoke && (
            <Button appearance="default" spacing="compact" onClick={() => openForm('revoke')}>
              {view.actions.revoke.label}
            </Button>
          )}
        </ActionRow>
      </SummaryBlock>

      {view.seal && (
        <Section title="Certificate & attestation details" count={3} defaultCollapsed={true}>
          <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
            <Text as="span" size="small" weight="medium">Signed by:</Text>
            {view.seal.signerClosed ? (
              <Text as="span" size="small">a deleted user</Text>
            ) : (
              <User accountId={view.seal.signerAccountId} />
            )}
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>on {view.seal.sealedAt}</Text>
          </Inline>
          <KeyValueInline label="Sign-off role:" value={view.seal.meaningLabel} />
          {view.seal.reason && <KeyValueInline label="Reason:" value={view.seal.reason} />}

          <NoteBox>
            <Text as="span" size="small" weight="medium">Tamper-evident seal</Text>
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>
              SHA-256 hash of covered fields, comments and attachments.
            </Text>
            <KeyValueInline
              label="Hash:"
              value={showDetails ? view.seal.hash : view.seal.hashShort}
              size="small"
            />
            <Box>
              <Button appearance="subtle" spacing="compact" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? 'Hide full hash' : 'Show full hash'}
              </Button>
            </Box>
          </NoteBox>

          <SubSection>
            <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
              <Text as="span" size="small" weight="semibold">
                Covered fields ({view.covered.length}), not covered ({view.excluded.length})
              </Text>
              <Button appearance="subtle" spacing="compact" onClick={() => setShowCovered(!showCovered)}>
                {showCovered ? 'Hide fields' : 'Show fields'}
              </Button>
            </Inline>
            {showCovered && (
              <Stack space={SPACE.sub}>
                <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                  Covered: {view.covered.join(', ')}
                </Text>
                {view.excluded.map(item => (
                  <Text as="span" size="small" color={TEXT_ROLE.muted} key={item.name}>
                    Not covered: {item.name}. {item.reason}
                  </Text>
                ))}
              </Stack>
            )}
          </SubSection>

          <SubSection>
            <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
              <Text as="span" size="small" weight="semibold">
                History ({view.seal.historyLength})
              </Text>
              <Button appearance="subtle" spacing="compact" onClick={loadHistory}>
                {history ? 'Hide history' : 'Show history'}
              </Button>
            </Inline>
            {historyError && <Text as="span" size="small" color={TEXT_ROLE.danger}>{historyError}</Text>}
            {history && (
              <Stack space={SPACE.sub}>
                {history.map(row => (
                  <Inline key={row.seq} space={SPACE.sub} alignBlock="center" shouldWrap>
                    <Text as="span" size="small">
                      {row.seq}. {historyLabel(row.transitionName)} on {formatTime(row.statusDatetime)}
                    </Text>
                    {row.actorAccountId ? (
                      <Inline space={SPACE.sub} alignBlock="center">
                        <Text as="span" size="small" color={TEXT_ROLE.secondary}>by</Text>
                        <User accountId={row.actorAccountId} />
                      </Inline>
                    ) : (
                      <Text as="span" size="small" color={TEXT_ROLE.secondary}>{row.actorClosed ? 'by a deleted user' : 'by LedgerSeal'}</Text>
                    )}
                    {row.reason && <Text as="span" size="small" color={TEXT_ROLE.secondary}>Reason: {row.reason}</Text>}
                  </Inline>
                ))}
                {historyNext && (
                  <Box>
                    <Button appearance="subtle" spacing="compact" onClick={() => loadHistoryPage(historyNext, history)}>
                      Show more history
                    </Button>
                  </Box>
                )}
              </Stack>
            )}
          </SubSection>

          <SubSection>
            <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
              <Text as="span" size="small" weight="semibold">Evidence record</Text>
              <Button appearance="subtle" spacing="compact" onClick={loadEvidence}>
                {evidence ? 'Hide evidence' : 'Show evidence (JSON)'}
              </Button>
            </Inline>
            {evidenceError && <Text as="span" size="small" color={TEXT_ROLE.danger}>{evidenceError}</Text>}
            {evidence && <CodeBlock language="json" text={evidence} />}
          </SubSection>

          {view.signingNote && (
            <SectionMessage appearance="warning">
              <Text as="span">{view.signingNote}</Text>
            </SectionMessage>
          )}

          <NoteBox>
            <Text as="span" size="small" color={TEXT_ROLE.muted}>{view.policyText}</Text>
            <Text as="span" size="small" color={TEXT_ROLE.muted}>
              Certificate: {view.seal.certificateId}. Canonical form {view.seal.canonicalizerVersion}. Declaration v{view.seal.declarationVersion}.
            </Text>
          </NoteBox>
        </Section>
      )}

      {form && (
        <Card>
          <Heading size="small">
            {form === 'revoke' ? 'Revoke seal' : form === 'approve' ? 'Approve these changes' : 'Seal this issue'}
          </Heading>
          {form !== 'revoke' && (
            <FormField id="meaning" label="Choose the role of your sign-off for this approval:">
              <RadioGroup
                name="meaning"
                options={MEANINGS.map(m => ({ name: 'meaning', value: m.value, label: m.label }))}
                value={meaning}
                onChange={(e: any) => setMeaning(e.target.value)}
              />
            </FormField>
          )}
          {reasonNeeded && (
            <FormField
              id="reason"
              label={form === 'revoke' ? 'Reason for revoking (required)' : sealReasonLabel || 'Reason for approving these changes (required)'}
            >
              {/* Uncontrolled on purpose: a controlled value lost typed characters over the UI Kit bridge (live, DEMO-34) */}
              <TextArea key={`reason-${form}`} id="reason" name="reason" onChange={(e: any) => setReason(e.target.value)} />
            </FormField>
          )}
          {form !== 'revoke' && (
            <Stack space={SPACE.sub}>
              <NoteBox>
                <Text as="span" size="small">{DECLARATION.text}</Text>
              </NoteBox>
              <Checkbox
                value="agreed"
                isChecked={declarationAgreed}
                onChange={(e: any) => setDeclarationAgreed(e.target.checked)}
                label="I agree to the declaration above."
              />
            </Stack>
          )}
          {actionError && (
            <SectionMessage appearance="warning">
              <Text as="span">{actionError}</Text>
            </SectionMessage>
          )}
          <ActionRow>
            <Button
              appearance="primary"
              isDisabled={reasonMissing || (form !== 'revoke' && !declarationAgreed) || submitting}
              onClick={submit}
            >
              {submitting ? 'Saving...' : form === 'revoke' ? 'Revoke' : 'Sign and seal'}
            </Button>
            <Button appearance="subtle" isDisabled={submitting} onClick={() => setForm(null)}>
              Cancel
            </Button>
          </ActionRow>
        </Card>
      )}
    </AppSurface>
  );
};

export default LedgerSealPanel;

ForgeReconciler.render(
  <React.StrictMode>
    <LedgerSealPanel />
  </React.StrictMode>
);
