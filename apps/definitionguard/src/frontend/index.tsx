/**
 * DefinitionGuard issue panel conforming to Asymm Systems In-Jira UI Standard.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Lozenge,
  SectionMessage,
  Stack,
  Inline,
  Checkbox,
  Spinner,
  User,
  Link,
  Textfield,
  CodeBlock
} from '@forge/react';
import { invoke, router } from '@forge/bridge';
import { IssueChecklistState, ChecklistAuditEvent } from '../domain/models';
import { buildPanelViewModel, historyRows, panelErrorText, Attribution } from '../ui/panel-view-model';
import {
  AppSurface,
  PanelHeader,
  SummaryBlock,
  KeyValueInline,
  Section,
  SubSection,
  NoteBox,
  ActionRow,
  ListRow,
  TEXT_ROLE,
  SPACE
} from '@asymm/jira-ui';

type Evidence = { url?: string; note?: string };
type HistoryPage = { auditTrail?: ChecklistAuditEvent[]; chain?: { ok: boolean; message: string; limit: string } };

const Who: React.FC<{ who?: Attribution }> = ({ who }) =>
  who ? (who.kind === 'user' ? <User accountId={who.accountId} /> : <Text as="span">{who.text}</Text>) : null;

// Renders the view model from src/ui/panel-view-model.ts. All rules and wording live there.
// Text fields are uncontrolled (no value prop): a controlled UI Kit Textfield loses keystrokes,
// because each key makes a round trip through the bridge (seen live on DEMO-35, 2026-11-01).
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

  const completeDoD = () => {
    const firstOpen = vm?.items.find(i => !i.checked);
    if (!firstOpen) return;
    if (firstOpen.needsEvidence) {
      setEvidenceFor(firstOpen.id);
    } else {
      change('toggleItem', { itemId: firstOpen.id, isCompleted: true }, firstOpen.id, 'save the change');
    }
  };

  const vm = buildPanelViewModel(checklist);

  if (loading && !vm) {
    return (
      <AppSurface>
        <Inline alignBlock="center" space={SPACE.item}>
          <Spinner size="small" />
          <Text as="span">Loading Definition of Done checklist...</Text>
        </Inline>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      {vm?.licenceNotice && (
        <SectionMessage appearance="warning" title="Licence not active">
          <Text as="span">{vm.licenceNotice}</Text>
        </SectionMessage>
      )}

      {errorMessage && (
        <SectionMessage appearance="error" title="Not saved">
          <Text as="span">{errorMessage}</Text>
        </SectionMessage>
      )}

      {showResetConfirm && (
        <SectionMessage appearance="warning" title="Reset this checklist?">
          <Stack space={SPACE.item}>
            <Text as="span">
              Every item becomes open again. The reset is added to the history; nothing in the history is removed.
            </Text>
            <ActionRow>
              <Button
                appearance="danger"
                isDisabled={loading}
                onClick={() => {
                  setShowResetConfirm(false);
                  change('resetChecklist', {}, 'reset', 'reset the checklist');
                }}
              >
                Reset checklist
              </Button>
              <Button appearance="subtle" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </Button>
            </ActionRow>
          </Stack>
        </SectionMessage>
      )}

      <PanelHeader
        title="Definition of Done"
        statusText={vm?.status.satisfied ? 'DoD complete' : 'Incomplete'}
        statusAppearance={vm?.status.satisfied ? 'success' : 'removed'}
        action={
          <Button
            appearance="default"
            spacing="compact"
            iconBefore="refresh"
            isDisabled={loading}
            onClick={loadChecklist}
          >
            Refresh
          </Button>
        }
      />

      {vm && (
        <SummaryBlock>
          <Stack space={SPACE.sub}>
            <Text as="span" weight="medium">
              {vm.status.satisfied
                ? 'Definition of Done satisfied: This issue can be moved to Done.'
                : `Definition of Done incomplete: moving to Done is blocked while mandatory items are open: ${(checklist?.openMandatoryTitles || []).join(', ')}.`}
            </Text>
            <KeyValueInline label="Next step:" value={vm.status.nextStep} />
            {vm.status.scope ? (
              <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                {vm.status.scope}
              </Text>
            ) : null}
            {vm.approverLine ? (
              <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                {vm.approverLine}
              </Text>
            ) : null}
          </Stack>

          <ActionRow>
            {!vm.status.satisfied ? (
              <Button
                appearance="primary"
                isDisabled={loading || busyId !== null}
                onClick={completeDoD}
              >
                Complete DoD
              </Button>
            ) : null}
            <Button
              appearance="subtle"
              spacing="compact"
              iconAfter="shortcut"
              onClick={() => router.open(`/browse/${checklist?.issueKey || ''}`)}
            >
              Open Four Realities panel
            </Button>
          </ActionRow>
        </SummaryBlock>
      )}

      {vm && (
        <Section
          title="Definition of Done items"
          count={vm.progress.text}
          defaultCollapsed={false}
        >
          <Stack space={SPACE.none}>
            {vm.items.map((item, idx) => (
              <ListRow key={item.id} divided={idx < vm.items.length - 1}>
                <Stack space={SPACE.sub}>
                  <Inline space={SPACE.item} alignBlock="center" spread="space-between" shouldWrap>
                    <Inline space={SPACE.item} alignBlock="center" shouldWrap>
                      <Checkbox
                        value={item.id}
                        name={item.label}
                        label={item.title}
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
                        <Lozenge key={l.text} appearance={l.appearance} isBold={l.appearance === 'success'}>
                          {l.text}
                        </Lozenge>
                      ))}
                    </Inline>
                    {(item.canAddEvidence || item.canWaive || item.canShowEvidence) && evidenceFor !== item.id && waiveFor !== item.id ? (
                      <Inline space={SPACE.sub} alignBlock="center">
                        {item.canAddEvidence && (
                          <Button appearance="default" spacing="compact" onClick={() => setEvidenceFor(item.id)}>
                            Tick with evidence
                          </Button>
                        )}
                        {item.canWaive && (
                          <Button appearance="default" spacing="compact" onClick={() => setWaiveFor(item.id)}>
                            Waive
                          </Button>
                        )}
                        {item.canShowEvidence && shownEvidence[item.id] === undefined && (
                          <Button
                            appearance="default"
                            spacing="compact"
                            onClick={() =>
                              run('load the evidence', item.id, async () => {
                                const res = (await invoke('getEvidence', { itemId: item.id })) as unknown as { evidence?: Evidence };
                                setShownEvidence({ ...shownEvidence, [item.id]: res?.evidence || null });
                              })
                            }
                          >
                            Show evidence
                          </Button>
                        )}
                      </Inline>
                    ) : null}
                  </Inline>

                  {item.attribution && (
                    <SubSection>
                      <Inline space={SPACE.sub} alignBlock="center">
                        <Who who={item.attribution} />
                        <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                          {item.doneText === 'Waived by' ? 'waived this' : 'completed this'} • {item.when}
                        </Text>
                      </Inline>
                    </SubSection>
                  )}

                  {evidenceFor === item.id && (
                    <SubSection>
                      <NoteBox>
                        <Stack space={SPACE.item}>
                          <Text as="span" weight="medium">
                            {item.needsEvidence ? 'This item needs evidence. Add a link, a note, or both.' : 'Add a link, a note, or both.'}
                          </Text>
                          <Textfield
                            id={`dg-ev-url-${item.id}`}
                            placeholder="https://..."
                            onChange={(e: any) => setEvUrl(e.target.value)}
                          />
                          <Textfield
                            id={`dg-ev-note-${item.id}`}
                            placeholder="Note (500 characters or less)"
                            maxLength={500}
                            onChange={(e: any) => setEvNote(e.target.value)}
                          />
                          <ActionRow>
                            <Button
                              appearance="primary"
                              spacing="compact"
                              isDisabled={busyId === item.id || (!evUrl.trim() && !evNote.trim())}
                              onClick={() =>
                                change(
                                  'toggleItem',
                                  { itemId: item.id, isCompleted: true, evidence: { url: evUrl.trim() || undefined, note: evNote.trim() || undefined } },
                                  item.id,
                                  'save the evidence'
                                )
                              }
                            >
                              Save and tick
                            </Button>
                            <Button appearance="subtle" spacing="compact" onClick={() => setEvidenceFor(null)}>
                              Cancel
                            </Button>
                          </ActionRow>
                        </Stack>
                      </NoteBox>
                    </SubSection>
                  )}

                  {waiveFor === item.id && (
                    <SubSection>
                      <NoteBox>
                        <Stack space={SPACE.item}>
                          <Text as="span" weight="medium">
                            Why does this item not apply? The reason is kept in the history.
                          </Text>
                          <Textfield
                            id={`dg-waive-${item.id}`}
                            placeholder="Reason (10 to 500 characters)"
                            maxLength={500}
                            onChange={(e: any) => setWaiveReason(e.target.value)}
                          />
                          <ActionRow>
                            <Button
                              appearance="warning"
                              spacing="compact"
                              isDisabled={busyId === item.id || waiveReason.trim().length < 10}
                              onClick={() => change('waiveItem', { itemId: item.id, reason: waiveReason }, item.id, 'waive the item')}
                            >
                              Waive item
                            </Button>
                            <Button appearance="subtle" spacing="compact" onClick={() => setWaiveFor(null)}>
                              Cancel
                            </Button>
                          </ActionRow>
                        </Stack>
                      </NoteBox>
                    </SubSection>
                  )}

                  {shownEvidence[item.id] && (
                    <SubSection>
                      <NoteBox>
                        <Stack space={SPACE.sub}>
                          {shownEvidence[item.id]!.url && (
                            <Link href={shownEvidence[item.id]!.url!} openNewTab>
                              {shownEvidence[item.id]!.url}
                            </Link>
                          )}
                          {shownEvidence[item.id]!.note && (
                            <Text as="span" size="small">
                              {shownEvidence[item.id]!.note}
                            </Text>
                          )}
                        </Stack>
                      </NoteBox>
                    </SubSection>
                  )}
                </Stack>
              </ListRow>
            ))}
          </Stack>

          <ActionRow>
            <Button
              appearance="default"
              spacing="compact"
              isDisabled={loading || busyId !== null || showResetConfirm}
              onClick={() => setShowResetConfirm(true)}
            >
              Reset checklist
            </Button>
          </ActionRow>
        </Section>
      )}

      <Section
        title="Checklist audit history"
        count={history?.auditTrail?.length}
        defaultCollapsed={true}
      >
        <Stack space={SPACE.group}>
          {!history ? (
            <ActionRow>
              <Button
                appearance="default"
                spacing="compact"
                isDisabled={loading}
                onClick={() =>
                  run('load the history', 'history', async () => {
                    setHistory((await invoke('getHistory', {})) as unknown as HistoryPage);
                  })
                }
              >
                Load audit history
              </Button>
            </ActionRow>
          ) : (
            <ActionRow>
              <Button
                appearance="default"
                spacing="compact"
                isDisabled={loading}
                onClick={() =>
                  run('load the history', 'history', async () => {
                    setHistory((await invoke('getHistory', {})) as unknown as HistoryPage);
                  })
                }
              >
                Refresh history
              </Button>
              <Button
                appearance="default"
                spacing="compact"
                isDisabled={loading}
                onClick={() =>
                  exported
                    ? setExported(null)
                    : run('export the history', 'export', async () => {
                        setExported((await invoke('exportHistory', {})) as unknown as { fileName: string; text: string });
                      })
                }
              >
                {exported ? 'Hide export' : 'Export history'}
              </Button>
            </ActionRow>
          )}

          {exported && (
            <NoteBox>
              <Stack space={SPACE.item}>
                <Text as="span" weight="semibold">Checklist history export: {exported.fileName}</Text>
                <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                  Copy this JSON and save it as {exported.fileName}. It holds every event and the result of the history check.
                </Text>
                <CodeBlock language="json" text={exported.text} />
              </Stack>
            </NoteBox>
          )}

          {history?.chain && (
            <NoteBox>
              <Stack space={SPACE.sub}>
                <Inline space={SPACE.item} alignBlock="center">
                  <Text as="span" weight="semibold">Cryptographic chain:</Text>
                  <Lozenge appearance={history.chain.ok ? 'success' : 'removed'} isBold>
                    {history.chain.ok ? 'Chain intact' : 'Chain broken'}
                  </Lozenge>
                </Inline>
                <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                  {history.chain.message}
                </Text>
                <Text as="span" size="small" color={TEXT_ROLE.muted}>
                  {history.chain.limit}
                </Text>
              </Stack>
            </NoteBox>
          )}

          {history && (
            <Stack space={SPACE.none}>
              {historyRows(history.auditTrail).map((row, idx, arr) => (
                <ListRow key={row.key} divided={idx < arr.length - 1}>
                  <Stack space={SPACE.sub}>
                    <Inline space={SPACE.item} alignBlock="center">
                      {row.accountId ? <User accountId={row.accountId} /> : <Text as="span" weight="medium">{row.actorText}</Text>}
                      <Text as="span" size="small" color={TEXT_ROLE.secondary}>• {row.when}</Text>
                    </Inline>
                    <SubSection>
                      <Inline space={SPACE.item} alignBlock="center">
                        <Lozenge
                          appearance={
                            row.eventType === 'CHECK'
                              ? 'success'
                              : row.eventType === 'WAIVE'
                              ? 'inprogress'
                              : row.eventType === 'UNCHECK'
                              ? 'moved'
                              : 'default'
                          }
                        >
                          {row.actionVerb || row.actionText}
                        </Lozenge>
                        {row.itemTitle ? (
                          <Text as="span" weight="medium">{row.itemTitle}</Text>
                        ) : (
                          <Text as="span">{row.actionText}</Text>
                        )}
                      </Inline>
                      {row.reason ? (
                        <NoteBox>
                          <KeyValueInline label="Reason:" value={row.reason} size="small" color={TEXT_ROLE.secondary} />
                        </NoteBox>
                      ) : null}
                      {row.evidence && (row.evidence.url || row.evidence.note) ? (
                        <NoteBox>
                          <Stack space={SPACE.tight}>
                            {row.evidence.url && <Link href={row.evidence.url} openNewTab>{row.evidence.url}</Link>}
                            {row.evidence.note && <Text as="span" size="small">{row.evidence.note}</Text>}
                          </Stack>
                        </NoteBox>
                      ) : null}
                    </SubSection>
                  </Stack>
                </ListRow>
              ))}
            </Stack>
          )}
        </Stack>
      </Section>
    </AppSurface>
  );
};

export default DefinitionGuardPanel;

ForgeReconciler.render(
  <React.StrictMode>
    <DefinitionGuardPanel />
  </React.StrictMode>
);
