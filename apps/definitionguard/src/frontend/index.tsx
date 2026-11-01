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
  User,
  Link,
  Textfield,
  List,
  ListItem,
  CodeBlock
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { IssueChecklistState, ChecklistAuditEvent } from '../domain/models';
import { buildPanelViewModel, historyRows, panelErrorText, Attribution } from '../ui/panel-view-model';

type Evidence = { url?: string; note?: string };
type HistoryPage = { auditTrail?: ChecklistAuditEvent[]; chain?: { ok: boolean; message: string; limit: string } };

const Who: React.FC<{ who?: Attribution }> = ({ who }) =>
  who ? (who.kind === 'user' ? <User accountId={who.accountId} /> : <Text>{who.text}</Text>) : null;

// Renders the view model from src/ui/panel-view-model.ts. All rules and wording live there.
export const DefinitionGuardPanel: React.FC = () => {
  const [checklist, setChecklist] = useState<IssueChecklistState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [evUrl, setEvUrl] = useState<string>('');
  const [evNote, setEvNote] = useState<string>('');
  const [waiveFor, setWaiveFor] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState<string>('');
  const [shownEvidence, setShownEvidence] = useState<Record<string, Evidence | null>>({});
  const [exported, setExported] = useState<{ fileName: string; text: string } | null>(null);

  const run = async (action: string, id: string | null, call: () => Promise<void>) => {
    setBusyId(id);
    setErrorMessage(null);
    try {
      await call();
    } catch (err) {
      console.error(`DefinitionGuard: ${action} failed`, err);
      setErrorMessage(panelErrorText(err, action));
    } finally {
      setBusyId(null);
    }
  };

  const loadChecklist = async () => {
    setLoading(true);
    await run('load the checklist', null, async () => {
      setChecklist((await invoke('getChecklist', {})) as unknown as IssueChecklistState);
    });
    setLoading(false);
  };

  useEffect(() => {
    loadChecklist();
  }, []);

  const change = (fn: string, payload: object, id: string, action: string) =>
    run(action, id, async () => {
      setChecklist((await invoke(fn, payload)) as unknown as IssueChecklistState);
      setEvidenceFor(null);
      setEvUrl('');
      setEvNote('');
      setWaiveFor(null);
      setWaiveReason('');
      setHistory(null);
    });

  const vm = buildPanelViewModel(checklist);

  if (loading && !vm) {
    return (
      <Inline alignBlock="center" space="space.100">
        <Spinner size="small" />
        <Text>Loading Definition of Done checklist...</Text>
      </Inline>
    );
  }

  return (
    <Stack space="space.150">
      {errorMessage && (
        <SectionMessage appearance="error" title="Not saved">
          <Text>{errorMessage}</Text>
        </SectionMessage>
      )}

      {vm && (
        <SectionMessage appearance={vm.status.appearance} title={vm.status.title}>
          <Text>{vm.status.body}</Text>
          {vm.status.scope && <Text>{vm.status.scope}</Text>}
          <Box paddingBlockStart="space.050">
            <Lozenge appearance={vm.status.lozenge.appearance}>{vm.status.lozenge.text}</Lozenge>
          </Box>
        </SectionMessage>
      )}

      {showResetConfirm && (
        <SectionMessage appearance="warning" title="Reset this checklist?">
          <Stack space="space.100">
            <Text>Every item becomes open again. The reset is added to the history; nothing in the history is removed.</Text>
            <Inline space="space.100">
              <Button appearance="danger" isDisabled={loading} onClick={() => { setShowResetConfirm(false); change('resetChecklist', {}, 'reset', 'reset the checklist'); }}>
                Reset checklist
              </Button>
              <Button appearance="subtle" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            </Inline>
          </Stack>
        </SectionMessage>
      )}

      {vm && (
        <Inline space="space.100" alignBlock="center">
          <Heading as="h4">Checklist items</Heading>
          <Lozenge appearance={vm.progress.appearance}>{vm.progress.text}</Lozenge>
        </Inline>
      )}

      <Stack space="space.100">
        {vm?.items.map(item => (
          <Box key={item.id} padding="space.050">
            <Inline space="space.100" alignBlock="center" shouldWrap>
              <Checkbox
                value={item.id}
                label={item.label}
                isChecked={item.checked}
                isDisabled={busyId === item.id}
                onChange={() => {
                  if (!item.checked && item.needsEvidence) {
                    setEvidenceFor(item.id);
                    return;
                  }
                  change('toggleItem', { itemId: item.id, isCompleted: !item.checked }, item.id, 'save the change');
                }}
              />
              {item.lozenges.map(l => (
                <Lozenge key={l.text} appearance={l.appearance}>{l.text}</Lozenge>
              ))}
            </Inline>

            {item.attribution && (
              <Box paddingInlineStart="space.200">
                <Inline space="space.050" alignBlock="center">
                  <Text>{item.doneText}</Text>
                  <Who who={item.attribution} />
                  <Text>{item.when}</Text>
                </Inline>
              </Box>
            )}

            {evidenceFor === item.id && (
              <Box paddingInlineStart="space.200">
                <Stack space="space.050">
                  <Text>{item.needsEvidence ? 'This item needs evidence. Add a link, a note, or both.' : 'Add a link, a note, or both.'}</Text>
                  <Textfield id={`dg-ev-url-${item.id}`} placeholder="https://..." value={evUrl} onChange={(e: any) => setEvUrl(e.target.value)} />
                  <Textfield id={`dg-ev-note-${item.id}`} placeholder="Note (500 characters or less)" maxLength={500} value={evNote} onChange={(e: any) => setEvNote(e.target.value)} />
                  <Inline space="space.100">
                    <Button
                      appearance="primary"
                      isDisabled={busyId === item.id || (!evUrl.trim() && !evNote.trim())}
                      onClick={() => change('toggleItem', { itemId: item.id, isCompleted: true, evidence: { url: evUrl.trim() || undefined, note: evNote.trim() || undefined } }, item.id, 'save the evidence')}
                    >
                      Save and tick
                    </Button>
                    <Button appearance="subtle" onClick={() => setEvidenceFor(null)}>Cancel</Button>
                  </Inline>
                </Stack>
              </Box>
            )}

            {waiveFor === item.id && (
              <Box paddingInlineStart="space.200">
                <Stack space="space.050">
                  <Text>Why does this item not apply? The reason is kept in the history.</Text>
                  <Textfield id={`dg-waive-${item.id}`} placeholder="Reason (10 to 500 characters)" maxLength={500} value={waiveReason} onChange={(e: any) => setWaiveReason(e.target.value)} />
                  <Inline space="space.100">
                    <Button appearance="warning" isDisabled={busyId === item.id || waiveReason.trim().length < 10} onClick={() => change('waiveItem', { itemId: item.id, reason: waiveReason }, item.id, 'waive the item')}>
                      Waive item
                    </Button>
                    <Button appearance="subtle" onClick={() => setWaiveFor(null)}>Cancel</Button>
                  </Inline>
                </Stack>
              </Box>
            )}

            {evidenceFor !== item.id && waiveFor !== item.id && (item.canAddEvidence || item.canWaive || item.canShowEvidence) && (
              <Box paddingInlineStart="space.200">
                <Inline space="space.100">
                  {item.canAddEvidence && <Button appearance="subtle" onClick={() => setEvidenceFor(item.id)}>Tick with evidence</Button>}
                  {item.canWaive && <Button appearance="subtle" onClick={() => setWaiveFor(item.id)}>Waive</Button>}
                  {item.canShowEvidence && shownEvidence[item.id] === undefined && (
                    <Button
                      appearance="subtle"
                      onClick={() => run('load the evidence', item.id, async () => {
                        const res = (await invoke('getEvidence', { itemId: item.id })) as unknown as { evidence?: Evidence };
                        setShownEvidence({ ...shownEvidence, [item.id]: res?.evidence || null });
                      })}
                    >
                      Show evidence
                    </Button>
                  )}
                </Inline>
                {shownEvidence[item.id] && (
                  <Stack space="space.050">
                    {shownEvidence[item.id]!.url && <Link href={shownEvidence[item.id]!.url!} openNewTab>{shownEvidence[item.id]!.url}</Link>}
                    {shownEvidence[item.id]!.note && <Text>{shownEvidence[item.id]!.note}</Text>}
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        ))}
      </Stack>

      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Button appearance="subtle" isDisabled={loading || busyId !== null || showResetConfirm} onClick={() => setShowResetConfirm(true)}>
          Reset checklist
        </Button>
        <Button
          appearance="subtle"
          isDisabled={loading}
          onClick={() => (history ? setHistory(null) : run('load the history', 'history', async () => setHistory((await invoke('getHistory', {})) as unknown as HistoryPage)))}
        >
          {history ? 'Hide history' : 'History'}
        </Button>
        <Button
          appearance="subtle"
          isDisabled={loading}
          onClick={() => (exported ? setExported(null) : run('export the history', 'export', async () => setExported((await invoke('exportHistory', {})) as unknown as { fileName: string; text: string })))}
        >
          {exported ? 'Hide export' : 'Export history'}
        </Button>
        <Button appearance="subtle" isDisabled={loading} onClick={loadChecklist}>Refresh</Button>
      </Inline>

      {exported && (
        <Stack space="space.100">
          <Text>Copy this JSON and save it as {exported.fileName}. It holds every event and the result of the history check.</Text>
          <CodeBlock language="json" text={exported.text} />
        </Stack>
      )}

      {history && (
        <Stack space="space.100">
          <Heading as="h4">History</Heading>
          {history.chain && (
            <SectionMessage appearance={history.chain.ok ? 'information' : 'error'}>
              <Text>{history.chain.message}</Text>
              <Text>{history.chain.limit}</Text>
            </SectionMessage>
          )}
          <List type="unordered">
            {historyRows(history.auditTrail).map(row => (
              <ListItem key={row.key}>
                <Inline space="space.050" alignBlock="center" shouldWrap>
                  <Text>{row.when}</Text>
                  <User accountId={row.accountId} />
                  <Text>{row.text}</Text>
                  {row.evidence?.url && <Link href={row.evidence.url} openNewTab>{row.evidence.url}</Link>}
                  {row.evidence?.note && <Text>{row.evidence.note}</Text>}
                </Inline>
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
    </Stack>
  );
};

export default DefinitionGuardPanel;

ForgeReconciler.render(
  <React.StrictMode>
    <DefinitionGuardPanel />
  </React.StrictMode>
);
