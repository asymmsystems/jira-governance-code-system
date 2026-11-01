import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Lozenge,
  SectionMessage,
  Stack,
  Inline,
  Heading,
  Textfield,
  Label,
  Checkbox,
  Box,
  Spinner,
  User
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { TamperAnalysis } from '../domain/models';

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
  const [meaning, setMeaning] = useState<string>('Approved for production release');
  const [reauthCode, setReauthCode] = useState<string>('');
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
      setAnalysis({
        status: 'NO_SEAL',
        tamperedFields: [],
        tamperedAttachments: [],
        verifiedAt: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSealSubmit = async () => {
    if (!declarationAgreed || !reauthCode.trim()) {
      return;
    }
    setSubmitting(true);
    setSealError(null);
    try {
      const result = (await invoke('seal-issue-api', {
        signature: {
          meaning,
          reasonCode: 'APPROVAL',
          declarationText: 'I electronically sign and seal this issue per compliance guidelines.',
          reauthConfirmation: reauthCode.trim()
        }
      })) as { ok: boolean; message?: string } | undefined;
      if (!result?.ok) {
        setSealError(result?.message || 'LedgerSeal could not seal this issue. Nothing was saved.');
        return;
      }
      setShowSignForm(false);
      setReauthCode('');
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
        <Text>Verifying cryptographic seal...</Text>
      </Inline>
    );
  }

  return (
    <Stack space="space.150">
      <Heading as="h4">LedgerSeal: Cryptographic Sign-Off &amp; Change Gate</Heading>

      {analysis?.status === 'SEAL_VALID' && (
        <SectionMessage appearance="success" title="Cryptographic Seal Verified">
          <Text>
            Signer: {analysis.seal?.sealedByName} ({analysis.seal?.meaning})
          </Text>
          <Text>
            Sealed At: {analysis.seal?.sealedAt}
          </Text>
          <Text>
            SHA-256 Hash: {analysis.sealedHash?.slice(0, 16)}...
          </Text>
          <Lozenge appearance="success">UNTAMPERED &amp; AUDIT READY</Lozenge>
        </SectionMessage>
      )}

      {analysis?.status === 'SEAL_COMPROMISED' && (
        <SectionMessage appearance="error" title="CRITICAL: Previous Unauthorized Modification Detected">
          <Text>
            Non-Monotonic Audit Alert: This issue was modified after sign-off and subsequently reverted.
            Reverting modified content does not heal a cryptographic seal. Explicit re-authorization is required.
          </Text>
          <Lozenge appearance="removed">PREVIOUSLY TAMPERED / COMPROMISED</Lozenge>
          <Button appearance="warning" onClick={() => setShowSignForm(true)}>
            Re-Authorize and Reseal
          </Button>
        </SectionMessage>
      )}

      {analysis?.status === 'SEAL_BROKEN' && (
        <SectionMessage appearance="error" title="CRITICAL: Cryptographic Seal Broken">
          <Text>
            This issue was modified after it was signed off by{' '}
            {analysis.seal?.sealedByName} at {analysis.seal?.sealedAt}.
          </Text>
          <Lozenge appearance="removed">TAMPER DETECTED</Lozenge>
          {analysis.tamperedFields.length > 0 && (
            <Stack space="space.050">
              <Heading as="h5">Altered Fields ({analysis.tamperedFields.length}):</Heading>
              {analysis.tamperedFields.map(diff => (
                <Box key={diff.fieldId} padding="space.050">
                  <Text>
                    {diff.fieldName}: "{formatDiffValue(diff.sealedValue)}" → "{formatDiffValue(diff.liveValue)}"
                  </Text>
                </Box>
              ))}
            </Stack>
          )}
          <Button appearance="warning" onClick={() => setShowSignForm(true)}>
            Re-Authorize and Reseal
          </Button>
        </SectionMessage>
      )}

      {(analysis?.status === 'LEGACY' || analysis?.status === 'RECORD_INVALID') && (
        <SectionMessage appearance="warning" title={analysis.status === 'LEGACY' ? 'Sealed with an old format' : 'Seal record failed its check'}>
          <Text>
            {analysis.status === 'LEGACY'
              ? 'This seal uses an old format. Reseal to get the new record.'
              : 'The stored seal record is incomplete. Contact your Jira admin.'}
          </Text>
          <Button appearance="primary" onClick={() => setShowSignForm(true)}>
            Seal Issue with Cryptographic Sign-Off
          </Button>
        </SectionMessage>
      )}

      {(!analysis || analysis.status === 'NO_SEAL') && (
        <SectionMessage appearance="information" title="Issue Not Sealed">
          <Text>
            This issue does not possess an active cryptographic seal. A seal is required to pass compliance workflow gates.
          </Text>
          <Button appearance="primary" onClick={() => setShowSignForm(true)}>
            Seal Issue with Cryptographic Sign-Off
          </Button>
        </SectionMessage>
      )}

      {analysis?.seal && (
        <Box padding="space.100">
          <Stack space="space.050">
            <Heading as="h5">Audit Certificate Details</Heading>
            <Text>Certificate ID: {analysis.seal.certificateId}</Text>
            <Inline space="space.050" alignBlock="center">
              <Text>Signer:</Text>
              <User accountId={analysis.seal.sealedByAccountId} />
            </Inline>
            <Text>Meaning: {analysis.seal.meaning}</Text>
            <Text>Digest: {analysis.sealedHash}</Text>
            <Button appearance="subtle" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide Certificate Details' : 'Inspect Certificate Metadata'}
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
            <Heading as="h4">Cryptographic Sign-Off &amp; Seal</Heading>
            <Label labelFor="meaning">Sign-Off Meaning / Regulatory Purpose</Label>
            <Textfield
              id="meaning"
              name="meaning"
              placeholder="e.g. Approved for production release"
              defaultValue={meaning}
              onChange={(e: any) => setMeaning(e.target.value)}
            />
            <Label labelFor="reauth">Signer Re-Authentication Challenge</Label>
            <Textfield
              id="reauth"
              name="reauth"
              placeholder="Type 'CONFIRM' to authorize signature"
              value={reauthCode}
              onChange={(e: any) => setReauthCode(e.target.value)}
            />
            <Checkbox
              value="agreed"
              isChecked={declarationAgreed}
              onChange={(e: any) => setDeclarationAgreed(e.target.checked)}
              label="I certify that I am the authorized signer and this record is complete, accurate, and ready for release."
            />
            {sealError && (
              <SectionMessage appearance="warning">
                <Text>{sealError}</Text>
              </SectionMessage>
            )}
            <Inline space="space.100">
              <Button
                appearance="primary"
                isDisabled={!declarationAgreed || !reauthCode.trim() || submitting}
                onClick={handleSealSubmit}
              >
                {submitting ? 'Sealing...' : 'Sign & Cryptographically Seal'}
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
