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
  TextArea
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { TamperAnalysis } from '../domain/models';
import { DECLARATION, MEANINGS } from '../domain/declaration';

function formatDiffValue(val: any): string {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'string') return val.length > 80 ? `${val.slice(0, 77)}...` : val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(formatDiffValue).join(', ') || '(empty list)';
  if (typeof val === 'object') {
    if (val.name) return val.name;
    if (val.displayName) return val.displayName;
    if (val.type === 'doc') return 'Rich text description updated';
    return Object.entries(val)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : String(v)}`)
      .slice(0, 3)
      .join(', ');
  }
  return String(val);
}

export const LedgerSealPanel: React.FC = () => {
  const [analysis, setAnalysis] = useState<TamperAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showSignForm, setShowSignForm] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [meaning, setMeaning] = useState<string>('APPROVAL');
  const [reason, setReason] = useState<string>('');
  const [declarationAgreed, setDeclarationAgreed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [sealError, setSealError] = useState<string | null>(null);

  useEffect(() => {
    loadTamperState();
  }, []);

  const loadTamperState = async () => {
    setLoading(true);
    try {
      const result = await invoke<TamperAnalysis>('verify-issue-api', {});
      if (result) {
        setAnalysis(result as TamperAnalysis);
      } else {
        setAnalysis({
          status: 'NO_SEAL',
          tamperedFields: [],
          tamperedAttachments: [],
          verifiedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to load seal state', err);
      // A failed load is an error state, never "not sealed" (LS-12)
      setAnalysis({
        status: 'ERROR',
        errorReason: 'JIRA_UNREACHABLE',
        tamperedFields: [],
        tamperedAttachments: [],
        verifiedAt: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Approving changes after a seal needs a reason
  const approvingChanges = analysis?.status === 'SEAL_BROKEN' || analysis?.status === 'SEAL_COMPROMISED';
  const reasonMissing = approvingChanges && reason.trim().length === 0;

  const handleSealSubmit = async () => {
    if (!declarationAgreed || reasonMissing) {
      return;
    }
    setSubmitting(true);
    setSealError(null);
    try {
      const result = (await invoke('seal-issue-api', {
        signature: {
          meaning,
          declarationVersion: DECLARATION.version,
          declarationText: DECLARATION.text,
          reason: approvingChanges ? reason.trim() : undefined
        }
      })) as { ok: boolean; message?: string } | undefined;
      if (!result?.ok) {
        setSealError(result?.message || 'LedgerSeal could not seal this issue. Nothing was saved.');
        return;
      }
      setShowSignForm(false);
      setReason('');
      setDeclarationAgreed(false);
      await loadTamperState();
    } catch (err) {
      console.error('Failed to seal issue', err);
      setSealError('LedgerSeal could not seal this issue. Nothing was saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Inline alignBlock="center">
        <Spinner size="small" />
        <Text>Checking the seal...</Text>
      </Inline>
    );
  }

  return (
    <Stack space="space.150">
      <Heading as="h4">LedgerSeal</Heading>

      {analysis?.status === 'SEAL_VALID' && (
        <SectionMessage appearance="success" title="Sealed. No change since approval.">
          <Text>
            Signer: {analysis.seal?.sealedByName} ({analysis.seal?.meaning})
          </Text>
          <Text>
            Sealed At: {analysis.seal?.sealedAt}
          </Text>
          {analysis.seal?.everCompromised && (
            <Text>Resealed after {analysis.seal.incidentCount} change incident(s). See the seal details.</Text>
          )}
          <Lozenge appearance="success">SEALED</Lozenge>
        </SectionMessage>
      )}

      {analysis?.status === 'SEAL_COMPROMISED' && (
        <SectionMessage appearance="error" title="Changed after approval, then changed back">
          <Text>
            This issue changed after approval and was later changed back. An approver must approve it again.
          </Text>
          <Lozenge appearance="removed">CHANGED</Lozenge>
          <Button appearance="warning" onClick={() => setShowSignForm(true)}>
            Approve these changes
          </Button>
        </SectionMessage>
      )}

      {analysis?.status === 'SEAL_BROKEN' && (
        <SectionMessage appearance="error" title="Changed after approval">
          <Text>
            This issue changed after it was approved by{' '}
            {analysis.seal?.sealedByName} at {analysis.seal?.sealedAt}.
          </Text>
          <Lozenge appearance="removed">CHANGED</Lozenge>
          {analysis.tamperedFields.length > 0 && (
            <Stack space="space.050">
              <Heading as="h5">Changed items ({analysis.tamperedFields.length})</Heading>
              {analysis.tamperedFields.map(diff => (
                <Box key={diff.fieldId} padding="space.050">
                  <Text>
                    {diff.fieldName}. Was: {formatDiffValue(diff.sealedValue)}. Now: {formatDiffValue(diff.liveValue)}
                  </Text>
                </Box>
              ))}
            </Stack>
          )}
          <Button appearance="warning" onClick={() => setShowSignForm(true)}>
            Approve these changes
          </Button>
        </SectionMessage>
      )}

      {(analysis?.status === 'LEGACY' || analysis?.status === 'RECORD_INVALID') && (
        <SectionMessage appearance="warning" title={analysis.status === 'LEGACY' ? 'Sealed with an old format' : 'Seal record failed its check'}>
          <Text>
            {analysis.status === 'LEGACY'
              ? 'This seal uses an old format. Reseal to get the new record.'
              : 'The stored seal record failed its integrity check. Contact your Jira admin.'}
          </Text>
          <Button appearance="primary" onClick={() => setShowSignForm(true)}>
            Seal this issue
          </Button>
        </SectionMessage>
      )}

      {analysis?.status === 'ERROR' && (
        <SectionMessage appearance="warning" title="LedgerSeal could not check this issue">
          <Text>
            {analysis.errorReason === 'STORAGE'
              ? 'LedgerSeal could not read its seal record. The seal state is unknown. Try again.'
              : 'Jira did not answer. The seal state is unknown. Try again.'}
          </Text>
          <Button appearance="primary" onClick={() => loadTamperState()}>
            Try again
          </Button>
        </SectionMessage>
      )}

      {(!analysis || analysis.status === 'NO_SEAL') && (
        <SectionMessage appearance="information" title="Not sealed">
          <Text>
            Seal this issue to record approval of its current content.
          </Text>
          <Lozenge>NOT SEALED</Lozenge>
          <Button appearance="primary" onClick={() => setShowSignForm(true)}>
            Seal this issue
          </Button>
        </SectionMessage>
      )}

      {analysis?.seal && (
        <Box padding="space.100">
          <Stack space="space.050">
            <Heading as="h5">Seal details</Heading>
            <Text>Certificate ID: {analysis.seal.certificateId}</Text>
            <Inline space="space.050" alignBlock="center">
              <Text>Signer:</Text>
              <User accountId={analysis.seal.sealedByAccountId} />
            </Inline>
            <Text>Meaning: {analysis.seal.meaning}</Text>
            <Text>Tamper-evident seal: SHA-256 hash of the covered fields, comments and attachments.</Text>
            <Text>Hash: {analysis.sealedHash}</Text>
            <Button appearance="subtle" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide seal details' : 'Show seal details'}
            </Button>
            {showDetails && (
              <Box padding="space.050">
                <Text>Algorithm: SHA-256 (canonical form {analysis.seal.canonicalizerVersion})</Text>
                <Text>History entries: {analysis.seal.historyLength}</Text>
                {analysis.seal.everCompromised && (
                  <Text>Change incidents across all seals: {analysis.seal.incidentCount}</Text>
                )}
              </Box>
            )}
          </Stack>
        </Box>
      )}

      {showSignForm && (
        <Box padding="space.150">
          <Stack space="space.100">
            <Heading as="h4">Seal this issue</Heading>
            <Label labelFor="meaning">Meaning</Label>
            <RadioGroup
              name="meaning"
              options={MEANINGS.map(m => ({ name: 'meaning', value: m.value, label: m.label }))}
              value={meaning}
              onChange={(e: any) => setMeaning(e.target.value)}
            />
            {approvingChanges && (
              <>
                <Label labelFor="reason">Reason for approving these changes (required)</Label>
                <TextArea id="reason" name="reason" value={reason} onChange={(e: any) => setReason(e.target.value)} />
              </>
            )}
            <Text>
              {DECLARATION.text} (Declaration v{DECLARATION.version})
            </Text>
            <Checkbox
              value="agreed"
              isChecked={declarationAgreed}
              onChange={(e: any) => setDeclarationAgreed(e.target.checked)}
              label="I agree to the declaration above."
            />
            {sealError && (
              <SectionMessage appearance="warning">
                <Text>{sealError}</Text>
              </SectionMessage>
            )}
            <Inline space="space.100">
              <Button
                appearance="primary"
                isDisabled={!declarationAgreed || reasonMissing || submitting}
                onClick={handleSealSubmit}
              >
                {submitting ? 'Sealing...' : 'Sign and seal'}
              </Button>
              <Button appearance="subtle" onClick={() => setShowSignForm(false)}>
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
