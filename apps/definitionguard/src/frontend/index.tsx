import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Lozenge,
  SectionMessage,
  Stack,
  Inline,
  Heading,
  Checkbox,
  Box,
  Spinner,
  Badge,
  User,
  Link,
  Textfield
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { IssueChecklistState } from '../domain/models';
import { attributionOf, gateStatusText } from '../ui/panel-view-model';

export const DefinitionGuardPanel: React.FC = () => {
  const [checklist, setChecklist] = useState<IssueChecklistState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);
  const [auditTrail, setAuditTrail] = useState<IssueChecklistState['auditTrail']>([]);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [waiveFor, setWaiveFor] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState<string>('');
  const [evUrl, setEvUrl] = useState<string>('');
  const [evNote, setEvNote] = useState<string>('');
  const [shownEvidence, setShownEvidence] = useState<Record<string, { url?: string; note?: string } | null>>({});
  const [chainCheck, setChainCheck] = useState<{ ok: boolean; message: string; limit: string } | null>(null);

  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await invoke<IssueChecklistState>('getChecklist', {});
      if (data) {
        setChecklist(data as IssueChecklistState);
      }
    } catch (err: any) {
      console.error('Failed to load checklist', err);
      setErrorMessage(err?.message || 'Failed to load checklist.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (itemId: string, currentCompleted: boolean, evidence?: { url?: string; note?: string }) => {
    setTogglingId(itemId);
    setErrorMessage(null);
    try {
      const updated = await invoke<IssueChecklistState>('toggleItem', {
        itemId,
        isCompleted: !currentCompleted,
        ...(evidence ? { evidence } : {})
      });
      if (updated) {
        setChecklist(updated as IssueChecklistState);
      }
      setEvidenceFor(null);
      setEvUrl('');
      setEvNote('');
    } catch (err: any) {
      console.error('Failed to toggle item', err);
      setErrorMessage(err?.message || 'Failed to toggle item.');
    } finally {
      setTogglingId(null);
    }
  };

  // Ticking an item that needs evidence opens the inline evidence form first.
  const startToggle = (itemId: string, currentCompleted: boolean, evidenceRequired?: boolean) => {
    if (!currentCompleted && evidenceRequired) {
      setEvidenceFor(itemId);
      return;
    }
    handleToggle(itemId, currentCompleted);
  };

  const handleWaive = async (itemId: string) => {
    setTogglingId(itemId);
    setErrorMessage(null);
    try {
      const updated = await invoke<IssueChecklistState>('waiveItem', { itemId, reason: waiveReason });
      if (updated) setChecklist(updated as IssueChecklistState);
      setWaiveFor(null);
      setWaiveReason('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'The item was not waived.');
    } finally {
      setTogglingId(null);
    }
  };

  const showEvidence = async (itemId: string) => {
    try {
      const res = (await invoke('getEvidence', { itemId })) as unknown as { evidence?: { url?: string; note?: string } };
      setShownEvidence({ ...shownEvidence, [itemId]: res?.evidence || null });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load the evidence.');
    }
  };

  const handleResetChecklist = async () => {
    setLoading(true);
    setErrorMessage(null);
    setShowResetConfirm(false);
    try {
      const resetState = await invoke<IssueChecklistState>('resetChecklist', {});
      if (resetState) {
        setChecklist(resetState as IssueChecklistState);
      }
    } catch (err: any) {
      console.error('Failed to reset checklist', err);
      setErrorMessage(err?.message || 'Failed to reset checklist.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAuditTrail = async () => {
    if (showAuditTrail) {
      setShowAuditTrail(false);
      return;
    }
    setErrorMessage(null);
    try {
      const page = (await invoke('getHistory', {})) as unknown as {
        auditTrail?: IssueChecklistState['auditTrail'];
        chain?: { ok: boolean; message: string; limit: string };
      };
      setAuditTrail(page?.auditTrail || []);
      setChainCheck(page?.chain || null);
      setShowAuditTrail(true);
    } catch (err: any) {
      console.error('Failed to load history', err);
      setErrorMessage(err?.message || 'Failed to load history.');
    }
  };

  const formatTimestamp = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toISOString().replace('T', ' ').substring(0, 19)} UTC`;
    } catch {
      return isoString;
    }
  };

  if (loading && !checklist) {
    return (
      <Inline alignBlock="center" space="space.100">
        <Spinner size="small" />
        <Text>Loading Definition of Done checklist...</Text>
      </Inline>
    );
  }

  const mandatoryItems = checklist?.items.filter(i => i.isMandatory) || [];
  const completedMandatory = mandatoryItems.filter(i => i.isCompleted).length;
  const totalCompleted = checklist?.items.filter(i => i.isCompleted).length || 0;
  const totalItems = checklist?.items.length || 0;

  return (
    <Stack space="space.150">
      {errorMessage && (
        <SectionMessage appearance="error" title="Error">
          <Text>{errorMessage}</Text>
        </SectionMessage>
      )}

      {checklist && (() => {
        const gate = gateStatusText(checklist);
        return (
          <SectionMessage appearance={gate.satisfied ? 'success' : 'warning'} title={gate.title}>
            <Text>{gate.body}</Text>
            {gate.scope && <Text>{gate.scope}</Text>}
          </SectionMessage>
        );
      })()}

      {showResetConfirm && (
        <SectionMessage appearance="warning" title="Confirm Checklist Reset (D-13)">
          <Stack space="space.100">
            <Text>
              Resetting will mark all items incomplete and add a record to the checklist history.
            </Text>
            <Inline space="space.100">
              <Button appearance="danger" onClick={handleResetChecklist} isDisabled={loading}>
                Confirm Reset
              </Button>
              <Button appearance="subtle" onClick={() => setShowResetConfirm(false)} isDisabled={loading}>
                Cancel
              </Button>
            </Inline>
          </Stack>
        </SectionMessage>
      )}

      <Box padding="space.100">
        <Inline space="space.100" alignBlock="center" spread="space-between">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h4">Checklist Items</Heading>
            <Lozenge appearance={totalCompleted === totalItems && totalItems > 0 ? "success" : "default"}>
              {totalCompleted} / {totalItems}
            </Lozenge>
          </Inline>
          <Text>v{checklist?.stateVersion || 1}</Text>
        </Inline>
      </Box>

      <Stack space="space.100">
        {checklist?.items.map(item => (
          <Box key={item.id} padding="space.050">
            <Inline space="space.100" alignBlock="center">
              <Checkbox
                value={item.id}
                isChecked={item.isCompleted}
                isDisabled={togglingId === item.id}
                onChange={() => startToggle(item.id, item.isCompleted, item.evidenceRequired)}
                label={item.title}
              />
              <Box>
                {item.isMandatory ? (
                  <Lozenge appearance="moved">MANDATORY</Lozenge>
                ) : (
                  <Lozenge appearance="default">OPTIONAL</Lozenge>
                )}
              </Box>
            </Inline>
            {evidenceFor === item.id && (
              <Box paddingInlineStart="space.200">
                <Stack space="space.050">
                  <Text>{item.evidenceRequired ? 'This item needs evidence. Add a link, a note, or both.' : 'Add a link, a note, or both.'}</Text>
                  <Textfield id={`dg-ev-url-${item.id}`} placeholder="https://..." value={evUrl} onChange={(e: any) => setEvUrl(e.target.value)} />
                  <Textfield id={`dg-ev-note-${item.id}`} placeholder="Note (500 characters or less)" maxLength={500} value={evNote} onChange={(e: any) => setEvNote(e.target.value)} />
                  <Inline space="space.100">
                    <Button
                      appearance="primary"
                      isDisabled={togglingId === item.id || (!evUrl.trim() && !evNote.trim())}
                      onClick={() => handleToggle(item.id, false, { url: evUrl.trim() || undefined, note: evNote.trim() || undefined })}
                    >
                      Save and tick
                    </Button>
                    <Button appearance="subtle" onClick={() => setEvidenceFor(null)}>Cancel</Button>
                  </Inline>
                </Stack>
              </Box>
            )}
            {!item.isCompleted && evidenceFor !== item.id && waiveFor !== item.id && (
              <Box paddingInlineStart="space.200">
                <Inline space="space.100">
                  {!item.evidenceRequired && <Button appearance="subtle" onClick={() => setEvidenceFor(item.id)}>Tick with evidence</Button>}
                  {item.isMandatory && <Button appearance="subtle" onClick={() => setWaiveFor(item.id)}>Waive</Button>}
                </Inline>
              </Box>
            )}
            {waiveFor === item.id && (
              <Box paddingInlineStart="space.200">
                <Stack space="space.050">
                  <Text>Why does this item not apply? The reason is kept in the history.</Text>
                  <Textfield id={`dg-waive-${item.id}`} placeholder="Reason (10 to 500 characters)" maxLength={500} value={waiveReason} onChange={(e: any) => setWaiveReason(e.target.value)} />
                  <Inline space="space.100">
                    <Button appearance="warning" isDisabled={togglingId === item.id || waiveReason.trim().length < 10} onClick={() => handleWaive(item.id)}>Waive item</Button>
                    <Button appearance="subtle" onClick={() => setWaiveFor(null)}>Cancel</Button>
                  </Inline>
                </Stack>
              </Box>
            )}
            {item.isCompleted && item.hasEvidence && (
              <Box paddingInlineStart="space.200">
                {shownEvidence[item.id] === undefined ? (
                  <Button appearance="subtle" onClick={() => showEvidence(item.id)}>Show evidence</Button>
                ) : (
                  <Stack space="space.050">
                    {shownEvidence[item.id]?.url && <Link href={shownEvidence[item.id]!.url!} openNewTab>{shownEvidence[item.id]!.url}</Link>}
                    {shownEvidence[item.id]?.note && <Text>{shownEvidence[item.id]!.note}</Text>}
                  </Stack>
                )}
              </Box>
            )}
            {item.isCompleted && (() => {
              const who = attributionOf({ byAccountId: item.completedByAccountId, legacyName: item.completedByLegacyName });
              return who ? (
                <Box paddingInlineStart="space.200">
                  <Inline space="space.050" alignBlock="center">
                    <Text>Completed by</Text>
                    {who.kind === 'user' ? <User accountId={who.accountId} /> : <Text>{who.text}</Text>}
                    <Text>at {formatTimestamp(item.completedAt)}</Text>
                  </Inline>
                </Box>
              ) : null;
            })()}
            {!item.isCompleted && item.history && item.history.length > 0 && item.history[item.history.length - 1].action === 'UNTICK' && (
              <Box paddingInlineStart="space.200">
                <Text>
                  Unchecked by {item.history[item.history.length - 1].userId} at {formatTimestamp(item.history[item.history.length - 1].timestamp)}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Stack>

      <Box padding="space.100">
        <Inline space="space.100" alignBlock="center">
          <Button
            appearance="subtle"
            onClick={() => setShowResetConfirm(true)}
            isDisabled={loading || togglingId !== null || showResetConfirm}
          >
            Reset Checklist
          </Button>
          <Button
            appearance="subtle"
            onClick={handleToggleAuditTrail}
            isDisabled={loading}
          >
            {showAuditTrail ? 'Hide Audit Trail' : `Audit Trail (${checklist?.stateVersion || 0})`}
          </Button>
          <Button appearance="subtle" onClick={loadChecklist} isDisabled={loading}>
            Refresh
          </Button>
        </Inline>
      </Box>

      {showAuditTrail && auditTrail && auditTrail.length > 0 && (
        <Box padding="space.100">
          <Heading as="h4">Audit Trail</Heading>
          {chainCheck && (
            <SectionMessage appearance={chainCheck.ok ? 'information' : 'error'}>
              <Text>{chainCheck.message}</Text>
              <Text>{chainCheck.limit}</Text>
            </SectionMessage>
          )}
          <Stack space="space.050">
            {auditTrail.map((ev) => (
              <Inline key={ev.id} space="space.050" alignBlock="center">
                <Text>[{formatTimestamp(ev.timestamp)}]</Text>
                <User accountId={ev.actorAccountId} />
                <Text>{ev.eventType} {ev.itemTitle ? `(${ev.itemTitle})` : ''}</Text>
              </Inline>
            ))}
          </Stack>
        </Box>
      )}

      <Box padding="space.100">
        <Text>
          Checklist Hash: {checklist?.checklistHash?.slice(0, 16)}...
        </Text>
      </Box>
    </Stack>
  );
};

export default DefinitionGuardPanel;

ForgeReconciler.render(
  <React.StrictMode>
    <DefinitionGuardPanel />
  </React.StrictMode>
);
