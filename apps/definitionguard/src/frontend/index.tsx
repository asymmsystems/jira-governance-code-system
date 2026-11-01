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
  Badge
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { IssueChecklistState } from '../domain/models';

export const DefinitionGuardPanel: React.FC = () => {
  const [checklist, setChecklist] = useState<IssueChecklistState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);
  const [auditTrail, setAuditTrail] = useState<IssueChecklistState['auditTrail']>([]);
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

  const handleToggle = async (itemId: string, currentCompleted: boolean) => {
    setTogglingId(itemId);
    setErrorMessage(null);
    try {
      const updated = await invoke<IssueChecklistState>('toggleItem', {
        itemId,
        isCompleted: !currentCompleted
      });
      if (updated) {
        setChecklist(updated as IssueChecklistState);
      }
    } catch (err: any) {
      console.error('Failed to toggle item', err);
      setErrorMessage(err?.message || 'Failed to toggle item.');
    } finally {
      setTogglingId(null);
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
  // Same rule as the validator: satisfied when every mandatory item is done (zero mandatory items counts as satisfied).
  const isGateOpen = checklist ? checklist.isFullySatisfied : false;

  return (
    <Stack space="space.150">
      {errorMessage && (
        <SectionMessage appearance="error" title="Error">
          <Text>{errorMessage}</Text>
        </SectionMessage>
      )}

      {isGateOpen ? (
        <SectionMessage appearance="success" title="Definition of Done Satisfied">
          <Text>All mandatory checklist items are complete. Workflow transition gate is open.</Text>
          <Box paddingBlockStart="space.050">
            <Lozenge appearance="success">GATE OPEN</Lozenge>
          </Box>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="warning" title="Definition of Done Incomplete">
          <Text>
            {mandatoryItems.length - completedMandatory} mandatory item(s) remain pending. Workflow transitions are blocked.
          </Text>
          <Box paddingBlockStart="space.050">
            <Lozenge appearance="inprogress">GATE LOCKED</Lozenge>
          </Box>
        </SectionMessage>
      )}

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
                onChange={() => handleToggle(item.id, item.isCompleted)}
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
            {item.isCompleted && item.completedBy && (
              <Box paddingInlineStart="space.200">
                <Text>
                  Completed by {item.completedBy} at {formatTimestamp(item.completedAt)}
                </Text>
              </Box>
            )}
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
              <Text key={ev.id}>
                • [{formatTimestamp(ev.timestamp)}] {ev.actorName}: {ev.eventType} {ev.itemId ? `(Item: ${ev.itemId})` : ''} {ev.details ? `[${ev.details}]` : ''}
              </Text>
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
