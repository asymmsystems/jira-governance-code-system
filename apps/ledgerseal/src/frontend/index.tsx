import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Lozenge,
  SectionMessage,
  Stack,
  Inline,
  Heading,
  Label,
  Checkbox,
  Box,
  Spinner,
  User,
  RadioGroup,
  TextArea,
  CodeBlock
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { DECLARATION, MEANINGS } from '../domain/declaration';
import { buildPanelView, formatTime, PanelView } from './view-model';

type FormMode = 'seal' | 'approve' | 'revoke' | null;

/**
 * The LedgerSeal issue panel. Every decision about what to show comes from the view model (view-model.ts);
 * this component only maps it to UI Kit components and holds the form state.
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
  const [evidence, setEvidence] = useState<string | null>(null);

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

  const loadHistory = async () => {
    if (history) {
      setHistory(null);
      return;
    }
    const page = (await invoke('seal-history-api', { fromSeq: 1 })) as { entries?: any[] } | undefined;
    setHistory(page?.entries ?? []);
  };

  const loadEvidence = async () => {
    if (evidence) {
      setEvidence(null);
      return;
    }
    setEvidence(JSON.stringify(await invoke('seal-evidence-api', {}), null, 2));
  };

  if (view.state === 'LOADING') {
    return (
      <Inline alignBlock="center">
        <Spinner size="small" />
        <Text>{view.title}</Text>
      </Inline>
    );
  }

  return (
    <Stack space="space.150">
      <SectionMessage appearance={view.message.appearance} title={view.title}>
        <Stack space="space.100">
          {view.message.lines.map(line => (
            <Text key={line}>{line}</Text>
          ))}
          {view.revokedByAccountId && (
            <Inline space="space.050" alignBlock="center">
              <Text>Revoked by:</Text>
              <User accountId={view.revokedByAccountId} />
            </Inline>
          )}
          {view.lozenge && (
            <Box paddingBlock="space.050">
              <Lozenge appearance={view.lozenge.appearance}>{view.lozenge.text}</Lozenge>
            </Box>
          )}
          {view.changes.length > 0 && (
            <Stack space="space.100">
              <Heading as="h5">Changed items ({view.changes.length})</Heading>
              {view.changes.map(row => (
                <Box key={row.fieldId} padding="space.100" backgroundColor="color.background.neutral.subtle">
                  <Stack space="space.050">
                    <Inline space="space.050" alignBlock="center">
                      <Text weight="bold">{row.fieldName}</Text>
                      {row.detail && <Text color="color.text.subtle">({row.detail})</Text>}
                    </Inline>
                    <Text color="color.text.subtle" weight="medium">Was (at approval):</Text>
                    <Box padding="space.050">
                      <Text>{fullValues[row.fieldId] ? row.wasFull : row.was}</Text>
                    </Box>
                    <Text color="color.text.danger" weight="medium">Now (current edit):</Text>
                    <Box padding="space.050">
                      <Text>{fullValues[row.fieldId] ? row.nowFull : row.now}</Text>
                    </Box>
                    <Inline space="space.050" alignBlock="center">
                      <Text color="color.text.subtlest">Changed by:</Text>
                      {row.changedBy.length > 0 ? row.changedBy.map(id => <User key={id} accountId={id} />) : <Text>unknown</Text>}
                      <Text color="color.text.subtlest">on {row.changedAt}</Text>
                    </Inline>
                    {row.showFullToggle && (
                      <Button appearance="subtle" onClick={() => setFullValues({ ...fullValues, [row.fieldId]: !fullValues[row.fieldId] })}>
                        {fullValues[row.fieldId] ? 'Show less' : 'Show full value'}
                      </Button>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
          <Box paddingBlockStart="space.050">
            <Inline space="space.100">
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
                <Button appearance="warning" onClick={() => openForm('approve')}>
                  {view.actions.approveChanges.label}
                </Button>
              )}
              {view.actions.revoke && (
                <Button appearance="default" onClick={() => openForm('revoke')}>
                  {view.actions.revoke.label}
                </Button>
              )}
              <Button appearance="subtle" onClick={() => loadState()}>
                Refresh status
              </Button>
            </Inline>
          </Box>
          {view.askText && (
            <Box padding="space.050">
              <Text weight="medium">{view.askText}</Text>
            </Box>
          )}
        </Stack>
      </SectionMessage>

      {view.seal && (
        <Box padding="space.100">
          <Stack space="space.050">
            <Heading as="h5">Seal details</Heading>
            <Inline space="space.050" alignBlock="center">
              <Text>Signer:</Text>
              <User accountId={view.seal.signerAccountId} />
            </Inline>
            <Text>
              Sealed: {view.seal.sealedAt}. Meaning: {view.seal.meaningLabel}.
            </Text>
            {view.seal.reason && <Text>Reason: {view.seal.reason}</Text>}
            <Text>Tamper-evident seal: SHA-256 hash of the covered fields, comments and attachments.</Text>
            <Text>Hash: {showDetails ? view.seal.hash : view.seal.hashShort}</Text>
            <Inline space="space.100">
              <Button appearance="subtle" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? 'Hide seal details' : 'Show seal details'}
              </Button>
              <Button appearance="subtle" onClick={() => setShowCovered(!showCovered)}>
                {showCovered ? 'Hide fields' : `Covered fields (${view.covered.length}), not covered (${view.excluded.length})`}
              </Button>
              <Button appearance="subtle" onClick={() => loadHistory()}>
                {history ? 'Hide history' : `History (${view.seal.historyLength})`}
              </Button>
              <Button appearance="subtle" onClick={() => loadEvidence()}>
                {evidence ? 'Hide evidence' : 'Show evidence (JSON)'}
              </Button>
            </Inline>
            {showDetails && (
              <Box padding="space.050">
                <Text>Certificate: {view.seal.certificateId}</Text>
                <Text>
                  Canonical form {view.seal.canonicalizerVersion}. Declaration v{view.seal.declarationVersion}.
                </Text>
              </Box>
            )}
            {showCovered && (
              <Box padding="space.050">
                <Text>Covered: {view.covered.join(', ')}</Text>
                {view.excluded.map(item => (
                  <Text key={item.name}>
                    Not covered: {item.name}. {item.reason}
                  </Text>
                ))}
              </Box>
            )}
            {history && (
              <Box padding="space.050">
                {history.map(row => (
                  <Text key={row.seq}>
                    {row.seq}. {row.transitionName} on {formatTime(row.statusDatetime)}
                    {row.reason ? `. Reason: ${row.reason}` : ''}
                  </Text>
                ))}
              </Box>
            )}
            {evidence && <CodeBlock language="json" text={evidence} />}
            <Text>{view.policyText}</Text>
          </Stack>
        </Box>
      )}

      {form && (
        <Box padding="space.150">
          <Stack space="space.100">
            <Heading as="h4">{form === 'revoke' ? 'Revoke seal' : form === 'approve' ? 'Approve these changes' : 'Seal this issue'}</Heading>
            {form !== 'revoke' && (
              <>
                <Label labelFor="meaning">Choose the role of your sign-off for this approval:</Label>
                <RadioGroup
                  name="meaning"
                  options={MEANINGS.map(m => ({ name: 'meaning', value: m.value, label: m.label }))}
                  value={meaning}
                  onChange={(e: any) => setMeaning(e.target.value)}
                />
              </>
            )}
            {reasonNeeded && (
              <>
                <Label labelFor="reason">
                  {form === 'revoke' ? 'Reason for revoking (required)' : sealReasonLabel || 'Reason for approving these changes (required)'}
                </Label>
                {/* Uncontrolled on purpose: a controlled value lost typed characters over the UI Kit bridge (live, DEMO-34) */}
                <TextArea key={`reason-${form}`} id="reason" name="reason" onChange={(e: any) => setReason(e.target.value)} />
              </>
            )}
            {form !== 'revoke' && (
              <>
                <Text>{DECLARATION.text}</Text>
                <Checkbox
                  value="agreed"
                  isChecked={declarationAgreed}
                  onChange={(e: any) => setDeclarationAgreed(e.target.checked)}
                  label="I agree to the declaration above."
                />
              </>
            )}
            {actionError && (
              <SectionMessage appearance="warning">
                <Text>{actionError}</Text>
              </SectionMessage>
            )}
            <Inline space="space.100">
              <Button
                appearance="primary"
                isDisabled={reasonMissing || (form !== 'revoke' && !declarationAgreed) || submitting}
                onClick={submit}
              >
                {submitting ? 'Saving...' : form === 'revoke' ? 'Revoke' : 'Sign and seal'}
              </Button>
              <Button appearance="subtle" onClick={() => setForm(null)}>
                Cancel
              </Button>
            </Inline>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default LedgerSealPanel;

ForgeReconciler.render(
  <React.StrictMode>
    <LedgerSealPanel />
  </React.StrictMode>
);
