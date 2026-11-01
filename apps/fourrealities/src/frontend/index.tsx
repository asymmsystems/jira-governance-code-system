/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: Delivery Integrity UI Kit Frontend
 */

import React, { useState, useEffect, useMemo } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Lozenge,
  SectionMessage,
  Stack,
  Inline,
  Box,
  Spinner,
  Badge,
  Button,
  ButtonGroup,
  ProgressBar,
  DynamicTable,
  Textfield,
  Select,
  Checkbox,
  TagGroup,
  Tag,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition
} from '@forge/react';
import { invoke, view } from '@forge/bridge';
import {
  ProjectAuditSnapshot,
  IssueIntegrityScore,
  GateStatus,
  IssueGates,
  RiskLevel
} from '../domain/models';

/**
 * Atlassian Design System Lozenge appearance mapping.
 * Passed: success (green)
 * Attention: moved (amber/yellow)
 * Blocked: removed (red)
 * Hollow: default (subtle grey)
 */
export const getGateAppearance = (status: GateStatus): 'success' | 'moved' | 'removed' | 'default' => {
  switch (status) {
    case 'PASSED': return 'success';
    case 'ATTENTION': return 'moved';
    case 'BLOCKED': return 'removed';
    case 'HOLLOW': return 'default';
  }
};

export const getRiskAppearance = (risk: RiskLevel): 'success' | 'moved' | 'removed' | 'default' => {
  switch (risk) {
    case 'LOW': return 'success';
    case 'MEDIUM': return 'moved';
    case 'HIGH':
    case 'CRITICAL': return 'removed';
    default: return 'default';
  }
};

export const GatePill: React.FC<{ status: GateStatus; label: string }> = ({ status, label }) => {
  const glyph = status === 'PASSED' ? '●' : status === 'ATTENTION' ? '◐' : status === 'BLOCKED' ? '✕' : '○';
  return (
    <Lozenge appearance={getGateAppearance(status)}>
      {glyph} {label}
    </Lozenge>
  );
};

export const GatePipeline: React.FC<{ gates: IssueGates }> = ({ gates }) => {
  return (
    <Inline space="space.050" alignBlock="center">
      <GatePill status={gates.intent} label="Intent" />
      <Text>──▶</Text>
      <GatePill status={gates.process} label="Process" />
      <Text>──▶</Text>
      <GatePill status={gates.code} label="Code" />
      <Text>──▶</Text>
      <GatePill status={gates.audit} label="Audit" />
    </Inline>
  );
};

export const MiniGateRow: React.FC<{ gates: IssueGates }> = ({ gates }) => {
  const getSymbol = (s: GateStatus) => (s === 'PASSED' ? '●' : s === 'ATTENTION' ? '◐' : s === 'BLOCKED' ? '✕' : '○');
  return (
    <Inline space="space.025" alignBlock="center">
      <Lozenge appearance={getGateAppearance(gates.intent)}>{getSymbol(gates.intent)}</Lozenge>
      <Lozenge appearance={getGateAppearance(gates.process)}>{getSymbol(gates.process)}</Lozenge>
      <Lozenge appearance={getGateAppearance(gates.code)}>{getSymbol(gates.code)}</Lozenge>
      <Lozenge appearance={getGateAppearance(gates.audit)}>{getSymbol(gates.audit)}</Lozenge>
    </Inline>
  );
};

interface StandardDoDItem {
  id: string;
  text: string;
  completed: boolean;
}

const DEFAULT_DOD_ITEMS: StandardDoDItem[] = [
  { id: 'dod-1', text: 'Unit & integration tests written and passing', completed: true },
  { id: 'dod-2', text: 'Acceptance criteria verified against specification', completed: true },
  { id: 'dod-3', text: 'Peer code review completed and approved', completed: true },
  { id: 'dod-4', text: 'Documentation updated (architecture / API / user docs)', completed: true },
  { id: 'dod-5', text: 'Security and static analysis scans clean', completed: true }
];

export const FourRealitiesApp: React.FC = () => {
  const [isIssueView, setIsIssueView] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<ProjectAuditSnapshot | null>(null);
  const [issueScore, setIssueScore] = useState<IssueIntegrityScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Issue Panel state
  const [showAllFindings, setShowAllFindings] = useState<boolean>(false);

  // Triage Workspace filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [realityFilter, setRealityFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [sprintFilter, setSprintFilter] = useState<string>('ALL');
  const [selectedIssueModal, setSelectedIssueModal] = useState<IssueIntegrityScore | null>(null);

  // Remediation Modals
  const [isLinkDecisionModalOpen, setIsLinkDecisionModalOpen] = useState<boolean>(false);
  const [linkTargetIssueId, setLinkTargetIssueId] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [linkTitle, setLinkTitle] = useState<string>('');
  const [linkSummary, setLinkSummary] = useState<string>('');

  const [isDoDModalOpen, setIsDoDModalOpen] = useState<boolean>(false);
  const [dodTargetIssueId, setDodTargetIssueId] = useState<string>('');
  const [dodItems, setDodItems] = useState<StandardDoDItem[]>(DEFAULT_DOD_ITEMS);

  const [isSealModalOpen, setIsSealModalOpen] = useState<boolean>(false);
  const [sealTargetIssue, setSealTargetIssue] = useState<IssueIntegrityScore | null>(null);

  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState<boolean>(false);
  const [exceptionTargetIssueId, setExceptionTargetIssueId] = useState<string>('');
  const [exceptionType, setExceptionType] = useState<'CODE' | 'REWORK'>('CODE');
  const [exceptionReason, setExceptionReason] = useState<string>('No code change: Configuration only');
  const [exceptionNotes, setExceptionNotes] = useState<string>('');

  useEffect(() => {
    init(false);
  }, []);

  const init = async (preserveSuccessMessage = false) => {
    setLoading(true);
    setErrorMessage(null);
    if (!preserveSuccessMessage) {
      setActionSuccessMessage(null);
    }
    try {
      const context = await view.getContext().catch(() => null);
      if (context?.extension?.issue) {
        setIsIssueView(true);
        const score = await invoke<IssueIntegrityScore>('getIssueAlignment', {});
        setIssueScore(score as IssueIntegrityScore);
      } else {
        setIsIssueView(false);
        const data = await invoke<ProjectAuditSnapshot>('getProjectDashboard', {});
        setSnapshot(data as ProjectAuditSnapshot);
      }
    } catch (err: any) {
      console.error('Failed to load FourRealities view', err);
      setErrorMessage(err?.message || 'Failed to load delivery integrity data.');
    } finally {
      setLoading(false);
    }
  };

  // --- Modal Openers ---
  const openLinkDecisionModal = (issueId: string, issueKey?: string) => {
    setLinkTargetIssueId(issueId);
    setLinkUrl('');
    setLinkTitle(`ADR: Architecture Decision for ${issueKey || issueId}`);
    setLinkSummary('Linked technical specification verifying Intent gate.');
    setIsLinkDecisionModalOpen(true);
  };

  const openDoDModal = (issueId: string) => {
    setDodTargetIssueId(issueId);
    setDodItems(DEFAULT_DOD_ITEMS.map(i => ({ ...i, completed: true })));
    setIsDoDModalOpen(true);
  };

  const openSealModal = (issue: IssueIntegrityScore) => {
    setSealTargetIssue(issue);
    setIsSealModalOpen(true);
  };

  const openExceptionModal = (issueId: string, type: 'CODE' | 'REWORK') => {
    setExceptionTargetIssueId(issueId);
    setExceptionType(type);
    setExceptionReason(type === 'CODE' ? 'No code change: Configuration only' : 'Requirement change requested by stakeholders');
    setExceptionNotes('');
    setIsExceptionModalOpen(true);
  };

  // --- Remediation Submissions ---
  const handleSubmitLinkDecision = async () => {
    setErrorMessage(null);
    try {
      const res: any = await invoke('linkDecision', {
        issueId: linkTargetIssueId,
        url: linkUrl,
        title: linkTitle,
        summary: linkSummary
      });

      if (res?.success) {
        setIsLinkDecisionModalOpen(false);
        setActionSuccessMessage(`Architecture Decision ("${linkTitle}") linked successfully. Intent gate verified.`);
        await init(true);
      } else {
        setErrorMessage(res?.error || 'Failed to link architecture decision.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing link decision.');
    }
  };

  const handleSubmitDoD = async () => {
    setErrorMessage(null);
    try {
      const res: any = await invoke('completeDod', {
        issueId: dodTargetIssueId,
        items: dodItems
      });

      if (res?.success) {
        setIsDoDModalOpen(false);
        setActionSuccessMessage('Definition of Done verified and recorded with cryptographic hash.');
        await init(true);
      } else {
        setErrorMessage(res?.error || 'Failed to complete Definition of Done.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing complete DoD.');
    }
  };

  const handleSubmitSeal = async () => {
    if (!sealTargetIssue) return;
    setErrorMessage(null);
    try {
      const res: any = await invoke('sealIssue', {
        issueId: sealTargetIssue.issueId,
        issueKey: sealTargetIssue.issueKey
      });

      if (res?.success && res.cert) {
        setIsSealModalOpen(false);
        setActionSuccessMessage(`Issue sealed successfully with certificate ${res.cert.certificateId}. Audit gate verified.`);
        await init(true);
      } else {
        setErrorMessage(res?.error || 'Failed to seal issue.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing cryptographic seal.');
    }
  };

  const handleSubmitException = async () => {
    setErrorMessage(null);
    try {
      const res: any = await invoke('recordException', {
        issueId: exceptionTargetIssueId,
        type: exceptionType,
        reason: exceptionReason,
        notes: exceptionNotes
      });

      if (res?.success) {
        setIsExceptionModalOpen(false);
        setActionSuccessMessage(`Justified exception recorded: "${exceptionReason}".`);
        await init(true);
      } else {
        setErrorMessage(res?.error || 'Failed to record exception.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error recording exception.');
    }
  };

  // All hooks run on every render, before any early return (React rules of hooks, FR-01).
  const summary = snapshot?.summary;
  const issues = snapshot?.issueScores || [];

  // Unique assignee and sprint options for triage filters
  const assigneeOptions = useMemo(() => {
    const names = Array.from(new Set(issues.map(i => i.assigneeName).filter(Boolean)));
    return [{ label: 'All Assignees', value: 'ALL' }, ...names.map(n => ({ label: n as string, value: n as string }))];
  }, [issues]);

  const sprintOptions = useMemo(() => {
    const sprints = Array.from(new Set(issues.map(i => i.sprintName).filter(Boolean)));
    return [{ label: 'All Sprints', value: 'ALL' }, ...sprints.map(s => ({ label: s as string, value: s as string }))];
  }, [issues]);

  // Filtered issues calculation for Triage Table
  const filteredIssues = useMemo(() => {
    return issues.filter(iss => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = iss.issueKey.toLowerCase().includes(q);
        const matchSummary = (iss.summary || '').toLowerCase().includes(q);
        const matchFinding = iss.synthesizedFinding.toLowerCase().includes(q);
        if (!matchKey && !matchSummary && !matchFinding) return false;
      }

      // 2. Reality Gap Filter
      if (realityFilter === 'INTENT' && iss.gates.intent !== 'BLOCKED') return false;
      if (realityFilter === 'PROCESS' && iss.gates.process !== 'ATTENTION') return false;
      if (realityFilter === 'CODE' && iss.gates.code !== 'BLOCKED') return false;
      if (realityFilter === 'AUDIT' && iss.gates.audit !== 'BLOCKED' && iss.gates.audit !== 'ATTENTION') return false;
      if (realityFilter === 'BLOCKERS' && iss.gates.intent !== 'BLOCKED' && iss.gates.code !== 'BLOCKED') return false;

      // 3. Risk Tier Filter
      if (riskFilter !== 'ALL' && iss.riskLevel !== riskFilter) return false;

      // 4. Assignee Filter
      if (assigneeFilter !== 'ALL' && iss.assigneeName !== assigneeFilter) return false;

      // 5. Sprint Filter
      if (sprintFilter !== 'ALL' && iss.sprintName !== sprintFilter) return false;

      return true;
    }).sort((a, b) => {
      // Default order: Worst first (Critical first, then lowest RAI)
      const rankMap: Record<RiskLevel, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, UNRATED: 5 };
      const rankDiff = rankMap[a.riskLevel] - rankMap[b.riskLevel];
      if (rankDiff !== 0) return rankDiff;
      return a.realityAlignmentIndex - b.realityAlignmentIndex;
    });
  }, [issues, searchQuery, realityFilter, riskFilter, assigneeFilter, sprintFilter]);

  if (loading) {
    return (
      <Inline alignBlock="center">
        <Spinner size="small" />
        <Text>Evaluating 4-Gate Delivery Pipeline metrics...</Text>
      </Inline>
    );
  }

  // Issue view whose score failed to load: show the error, never the project dashboard.
  if (isIssueView && !issueScore) {
    return (
      <SectionMessage appearance="error" title="Delivery integrity unavailable">
        <Text>{errorMessage || 'Failed to load delivery integrity data.'}</Text>
      </SectionMessage>
    );
  }

  // =========================================================================
  // SURFACE 1: Jira Issue Panel / Issue Context View
  // =========================================================================
  if (isIssueView && issueScore) {
    const riskAppearance = getRiskAppearance(issueScore.riskLevel);

    return (
      <Stack space="space.150">
        {errorMessage && (
          <SectionMessage appearance="error" title="Error">
            <Text>{errorMessage}</Text>
          </SectionMessage>
        )}

        {actionSuccessMessage && (
          <SectionMessage appearance="success" title="Gate Remediated">
            <Text>{actionSuccessMessage}</Text>
          </SectionMessage>
        )}

        {/* Compact Glanceable Header */}
        <Box padding="space.100">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h4">Delivery Integrity: {issueScore.issueKey}</Heading>
            <Lozenge appearance={riskAppearance}>
              {issueScore.isEvaluated ? `${issueScore.realityAlignmentIndex}% ALIGNED (${issueScore.riskLevel})` : 'EARLY STAGE'}
            </Lozenge>
            <Button appearance="subtle" onClick={() => init(false)}>Refresh</Button>
          </Inline>
        </Box>

        {/* 4-Gate Pipeline Chain */}
        <Box padding="space.100">
          <Stack space="space.075">
            <Text>Evidence Pipeline:</Text>
            <GatePipeline gates={issueScore.gates} />
          </Stack>
        </Box>

        {/* Synthesized Finding & Recoverable Points */}
        <Box padding="space.100">
          <Stack space="space.075">
            <Text>
              Diagnosis: <Text>{issueScore.synthesizedFinding}</Text>
            </Text>
            {issueScore.recoverablePoints > 0 && (
              <Inline space="space.050" alignBlock="center">
                <Badge appearance="added">+{issueScore.recoverablePoints} pts recoverable</Badge>
                <Text>
                  Resolve the primary blocked gate to reach{' '}
                  {Math.min(100, issueScore.realityAlignmentIndex + issueScore.recoverablePoints)}% alignment.
                </Text>
              </Inline>
            )}
            <Text>{issueScore.whyScoreExplanation}</Text>
          </Stack>
        </Box>

        {/* Context-Aware Remediation Actions */}
        <Box padding="space.100">
          <Inline space="space.100" alignBlock="center">
            {issueScore.gates.intent === 'BLOCKED' && (
              <Button appearance="primary" onClick={() => openLinkDecisionModal(issueScore.issueId, issueScore.issueKey)}>
                Link Decision (ADR)
              </Button>
            )}

            {issueScore.gates.code === 'BLOCKED' && (
              <Button appearance="default" onClick={() => openExceptionModal(issueScore.issueId, 'CODE')}>
                Explain: No Code Change
              </Button>
            )}

            {issueScore.gates.process === 'ATTENTION' && (
              <Button appearance="default" onClick={() => openExceptionModal(issueScore.issueId, 'REWORK')}>
                Add Rework Reason
              </Button>
            )}

            {/* Audit actions: only available when work is progressing or done */}
            {issueScore.statusCategory !== 'To Do' && issueScore.gates.audit !== 'PASSED' && (
              <>
                <Button appearance="default" onClick={() => openDoDModal(issueScore.issueId)}>
                  Review & Complete DoD
                </Button>
                {issueScore.statusCategory === 'Done' && (
                  <Button appearance="default" onClick={() => openSealModal(issueScore)}>
                    Seal Issue
                  </Button>
                )}
              </>
            )}

            <Button appearance="subtle" onClick={() => setShowAllFindings(!showAllFindings)}>
              {showAllFindings ? 'Hide Details ▲' : 'View Details ▾'}
            </Button>
          </Inline>
        </Box>

        {/* Detailed Findings & Score Math */}
        {showAllFindings && (
          <Box padding="space.100">
            <Stack space="space.100">
              <Heading as="h5">Score Breakdown & Evidence</Heading>
              {issueScore.findings.map((f, idx) => (
                <Text key={idx}>• {f}</Text>
              ))}
            </Stack>
          </Box>
        )}

        {/* Link Decision Modal */}
        <ModalTransition>
          {isLinkDecisionModalOpen && (
            <Modal onClose={() => setIsLinkDecisionModalOpen(false)}>
              <ModalHeader>
                <ModalTitle>Link Architecture Decision / Specification</ModalTitle>
              </ModalHeader>
              <ModalBody>
                <Stack space="space.100">
                  <Text>
                    Connect an authentic Confluence Architecture Decision Record (ADR), technical RFC, or design specification.
                  </Text>
                  <Textfield
                    placeholder="https://confluence.example.com/wiki/spaces/ARCH/pages/ADR-042"
                    value={linkUrl}
                    onChange={(e: any) => setLinkUrl(e.target?.value || '')}
                  />
                  <Textfield
                    placeholder="ADR-042: Event-driven payment settlement"
                    value={linkTitle}
                    onChange={(e: any) => setLinkTitle(e.target?.value || '')}
                  />
                  <Textfield
                    placeholder="Summary of decision scope..."
                    value={linkSummary}
                    onChange={(e: any) => setLinkSummary(e.target?.value || '')}
                  />
                </Stack>
              </ModalBody>
              <ModalFooter>
                <Button appearance="subtle" onClick={() => setIsLinkDecisionModalOpen(false)}>
                  Cancel
                </Button>
                <Button appearance="primary" onClick={handleSubmitLinkDecision}>
                  Confirm & Link Decision
                </Button>
              </ModalFooter>
            </Modal>
          )}
        </ModalTransition>

        {/* Complete DoD Modal */}
        <ModalTransition>
          {isDoDModalOpen && (
            <Modal onClose={() => setIsDoDModalOpen(false)}>
              <ModalHeader>
                <ModalTitle>Definition of Done Checklist Verification</ModalTitle>
              </ModalHeader>
              <ModalBody>
                <Stack space="space.100">
                  <Text>
                    Verify all required engineering criteria. Check each item to confirm completion before recording satisfaction.
                  </Text>
                  {dodItems.map(item => (
                    <Checkbox
                      key={item.id}
                      label={item.text}
                      isChecked={item.completed}
                      onChange={(e: any) => {
                        const checked = Boolean(e.target?.checked);
                        setDodItems(dodItems.map(i => i.id === item.id ? { ...i, completed: checked } : i));
                      }}
                    />
                  ))}
                  <ProgressBar value={dodItems.filter(i => i.completed).length / (dodItems.length || 1)} />
                  <Text>
                    {dodItems.filter(i => i.completed).length} of {dodItems.length} items verified
                  </Text>
                </Stack>
              </ModalBody>
              <ModalFooter>
                <Button appearance="subtle" onClick={() => setIsDoDModalOpen(false)}>
                  Cancel
                </Button>
                <Button appearance="primary" onClick={handleSubmitDoD}>
                  Confirm & Record DoD
                </Button>
              </ModalFooter>
            </Modal>
          )}
        </ModalTransition>

        {/* Seal Confirmation Modal */}
        <ModalTransition>
          {isSealModalOpen && sealTargetIssue && (
            <Modal onClose={() => setIsSealModalOpen(false)}>
              <ModalHeader>
                <ModalTitle>Seal {sealTargetIssue.issueKey} as Complete?</ModalTitle>
              </ModalHeader>
              <ModalBody>
                <Stack space="space.100">
                  <Text>
                    This action records a tamper-evident cryptographic SHA-256 seal of the current issue state:
                  </Text>
                  <Text>✓ Intent traceability: {sealTargetIssue.gates.intent}</Text>
                  <Text>✓ Review approval: {sealTargetIssue.gates.code}</Text>
                  <Text>✓ Definition of Done: Complete</Text>
                  <SectionMessage appearance="warning" title="Irreversible Audit Action">
                    <Text>
                      Sealing generates an immutable audit certificate. Once sealed, any downstream field modifications will invalidate the seal.
                    </Text>
                  </SectionMessage>
                </Stack>
              </ModalBody>
              <ModalFooter>
                <Button appearance="subtle" onClick={() => setIsSealModalOpen(false)}>
                  Cancel
                </Button>
                <Button appearance="primary" onClick={handleSubmitSeal}>
                  Confirm & Seal Issue
                </Button>
              </ModalFooter>
            </Modal>
          )}
        </ModalTransition>

        {/* Explain Exception Modal */}
        <ModalTransition>
          {isExceptionModalOpen && (
            <Modal onClose={() => setIsExceptionModalOpen(false)}>
              <ModalHeader>
                <ModalTitle>
                  {exceptionType === 'CODE' ? 'Record Code Gate Exception' : 'Record Workflow Rework Reason'}
                </ModalTitle>
              </ModalHeader>
              <ModalBody>
                <Stack space="space.100">
                  <Text>
                    {exceptionType === 'CODE'
                      ? 'Specify why this delivery item does not require an associated Pull Request:'
                      : 'Specify the primary driver of this workflow rework loop:'}
                  </Text>
                  <Textfield
                    value={exceptionReason}
                    onChange={(e: any) => setExceptionReason(e.target?.value || '')}
                  />
                  <Textfield
                    placeholder="Optional reference or rationale..."
                    value={exceptionNotes}
                    onChange={(e: any) => setExceptionNotes(e.target?.value || '')}
                  />
                </Stack>
              </ModalBody>
              <ModalFooter>
                <Button appearance="subtle" onClick={() => setIsExceptionModalOpen(false)}>
                  Cancel
                </Button>
                <Button appearance="primary" onClick={handleSubmitException}>
                  Save Exception
                </Button>
              </ModalFooter>
            </Modal>
          )}
        </ModalTransition>
      </Stack>
    );
  }

  // =========================================================================
  // SURFACE 2: Project-wide Executive Dashboard & Triage Workspace
  // =========================================================================

  const avgRAI = summary?.averageRAI || 0;
  const headlineRiskAppearance = avgRAI >= 80 ? 'success' : avgRAI >= 60 ? 'moved' : 'removed';

  // Dynamic table row formatting with authentic sortable cell keys
  const tableRows = filteredIssues.map(iss => ({
    key: iss.issueId,
    cells: [
      {
        key: iss.issueKey, // Genuine sort key
        content: <Text>{iss.issueKey}</Text>
      },
      {
        key: iss.summary || '',
        content: <Text>{iss.summary || 'Engineering Delivery Item'}</Text>
      },
      {
        key: `${iss.gates.intent}-${iss.gates.process}-${iss.gates.code}-${iss.gates.audit}`,
        content: <MiniGateRow gates={iss.gates} />
      },
      {
        key: String(iss.realityAlignmentIndex).padStart(3, '0'), // Genuine numerical sort key
        content: <Text>{iss.realityAlignmentIndex}%</Text>
      },
      {
        key: iss.riskLevel === 'CRITICAL' ? '1' : iss.riskLevel === 'HIGH' ? '2' : iss.riskLevel === 'MEDIUM' ? '3' : '4',
        content: (
          <Lozenge appearance={getRiskAppearance(iss.riskLevel)}>
            {iss.riskLevel}
          </Lozenge>
        )
      },
      {
        key: iss.synthesizedFinding,
        content: <Text>{iss.synthesizedFinding}</Text>
      },
      {
        key: iss.assigneeName || 'Unassigned',
        content: <Text>{iss.assigneeName || 'Unassigned'}</Text>
      },
      {
        key: 'action',
        content: (
          <Button appearance="subtle" onClick={() => setSelectedIssueModal(iss)}>
            Inspect
          </Button>
        )
      }
    ]
  }));

  const tableHead = {
    cells: [
      { key: 'key', content: 'Issue', isSortable: true },
      { key: 'summary', content: 'Summary' },
      { key: 'gates', content: 'Gates', isSortable: true },
      { key: 'rai', content: 'RAI', isSortable: true },
      { key: 'tier', content: 'Risk Tier', isSortable: true },
      { key: 'finding', content: 'Top Diagnostic Finding' },
      { key: 'assignee', content: 'Assignee', isSortable: true },
      { key: 'action', content: 'Action' }
    ]
  };

  // Modal navigation index helper
  const selectedModalIndex = selectedIssueModal
    ? filteredIssues.findIndex(i => i.issueId === selectedIssueModal.issueId)
    : -1;

  return (
    <Stack space="space.200">
      {errorMessage && (
        <SectionMessage appearance="error" title="Error">
          <Text>{errorMessage}</Text>
        </SectionMessage>
      )}

      {actionSuccessMessage && (
        <SectionMessage appearance="success" title="Action Completed">
          <Text>{actionSuccessMessage}</Text>
        </SectionMessage>
      )}

      {snapshot?.warning && (
        <SectionMessage appearance="warning" title="Sync Notice">
          <Text>{snapshot.warning}</Text>
        </SectionMessage>
      )}

      {/* 1. Executive Hero Section */}
      <Box padding="space.150">
        <Stack space="space.100">
          <Inline space="space.200" alignBlock="center">
            <Heading as="h3">Delivery Alignment Index (RAI)</Heading>
            <Lozenge appearance={headlineRiskAppearance}>
              {avgRAI}% ALIGNED · {summary?.sprintName || 'Active Delivery'}
            </Lozenge>
            {summary?.hasTrendHistory && summary?.sprintDelta !== undefined && (
              <Badge appearance={summary.sprintDelta >= 0 ? 'added' : 'important'}>
                {summary.sprintDelta >= 0 ? `▲ +${summary.sprintDelta}` : `▼ ${summary.sprintDelta}`} pts vs last scan
              </Badge>
            )}
            <Button appearance="subtle" onClick={() => init(false)}>Refresh Scan</Button>
          </Inline>

          <Inline space="space.150" alignBlock="center">
            <Text>Weakest Gate: {summary?.weakestGate?.toUpperCase() || 'AUDIT'} REALITY</Text>
            <Text>·</Text>
            <Text>Scope: {summary?.totalAuditedIssues || 0} issues audited</Text>
            <Text>·</Text>
            <Text>{summary?.biggestMover || summary?.trendNotice || 'Baseline scan · History tracking active'}</Text>
          </Inline>

          {/* Interactive Risk Distribution Filter Chips */}
          <Inline space="space.050" alignBlock="center">
            <Text>Risk Distribution:</Text>
            <Button
              appearance={riskFilter === 'ALL' ? 'primary' : 'default'}
              onClick={() => setRiskFilter('ALL')}
            >
              All ({summary?.totalAuditedIssues || 0})
            </Button>
            <Button
              appearance={riskFilter === 'LOW' ? 'primary' : 'default'}
              onClick={() => setRiskFilter('LOW')}
            >
              Low ({summary?.riskDistribution?.low || 0})
            </Button>
            <Button
              appearance={riskFilter === 'MEDIUM' ? 'primary' : 'default'}
              onClick={() => setRiskFilter('MEDIUM')}
            >
              Med ({summary?.riskDistribution?.medium || 0})
            </Button>
            <Button
              appearance={riskFilter === 'HIGH' ? 'primary' : 'default'}
              onClick={() => setRiskFilter('HIGH')}
            >
              High ({summary?.riskDistribution?.high || 0})
            </Button>
            <Button
              appearance={riskFilter === 'CRITICAL' ? 'primary' : 'default'}
              onClick={() => setRiskFilter('CRITICAL')}
            >
              Crit ({summary?.riskDistribution?.critical || 0})
            </Button>
          </Inline>
        </Stack>
      </Box>

      {/* 2. Four Reality Health Cards Row */}
      {(() => {
        const hasIssues = Boolean(summary && summary.totalAuditedIssues > 0);
        const intentRate = hasIssues ? summary!.m11TraceabilityRate : 0;
        const processRate = hasIssues ? 100 - summary!.m30ReworkLoopRate : 0;
        const codeRate = hasIssues ? summary!.m29ReviewComplianceRate : 0;
        const auditRate = hasIssues ? summary!.m40AuditComplianceRate : 0;
        const total = summary?.totalAuditedIssues || 0;
        const doneTotal = summary?.doneCount || 0;
        const sealedCount = summary?.sealedDoneCount || 0;

        return (
          <Inline space="space.150">
            {/* Intent Card */}
            <Box padding="space.100">
              <Stack space="space.050">
                <Inline space="space.050" alignBlock="center">
                  <Heading as="h4">◆ Intent</Heading>
                  <Lozenge appearance={intentRate >= 75 ? 'success' : intentRate >= 50 ? 'moved' : 'removed'}>
                    {intentRate}%
                  </Lozenge>
                </Inline>
                <Text>Is work traced to a decision?</Text>
                <ProgressBar value={intentRate / 100} />
                <Text>
                  {Math.round((intentRate / 100) * total)} of {total} issues linked to spec
                </Text>
                <Button appearance="subtle" onClick={() => setRealityFilter('INTENT')}>
                  Filter Missing Intent →
                </Button>
              </Stack>
            </Box>

            {/* Process Card */}
            <Box padding="space.100">
              <Stack space="space.050">
                <Inline space="space.050" alignBlock="center">
                  <Heading as="h4">◆ Process</Heading>
                  <Lozenge appearance={processRate >= 75 ? 'success' : processRate >= 50 ? 'moved' : 'removed'}>
                    {processRate}%
                  </Lozenge>
                </Inline>
                <Text>Did work flow cleanly?</Text>
                <ProgressBar value={processRate / 100} />
                <Text>
                  {Math.round((processRate / 100) * total)} of {total} zero-rework issues
                </Text>
                <Button appearance="subtle" onClick={() => setRealityFilter('PROCESS')}>
                  Filter Rework Churn →
                </Button>
              </Stack>
            </Box>

            {/* Code Card */}
            <Box padding="space.100">
              <Stack space="space.050">
                <Inline space="space.050" alignBlock="center">
                  <Heading as="h4">◆ Code</Heading>
                  <Lozenge appearance={codeRate >= 75 ? 'success' : codeRate >= 50 ? 'moved' : 'removed'}>
                    {codeRate}%
                  </Lozenge>
                </Inline>
                <Text>Reviewed before merge?</Text>
                <ProgressBar value={codeRate / 100} />
                <Text>
                  {Math.round((codeRate / 100) * total)} of {total} PRs peer approved
                </Text>
                <Button appearance="subtle" onClick={() => setRealityFilter('CODE')}>
                  Filter Unreviewed PRs →
                </Button>
              </Stack>
            </Box>

            {/* Audit Card */}
            <Box padding="space.100">
              <Stack space="space.050">
                <Inline space="space.050" alignBlock="center">
                  <Heading as="h4">◆ Audit</Heading>
                  <Lozenge appearance={auditRate >= 75 ? 'success' : auditRate >= 50 ? 'moved' : 'removed'}>
                    {auditRate}%
                  </Lozenge>
                </Inline>
                <Text>Proven and sealed?</Text>
                <ProgressBar value={auditRate / 100} />
                <Text>
                  {sealedCount} of {doneTotal} completed issues sealed
                </Text>
                <Button appearance="subtle" onClick={() => setRealityFilter('AUDIT')}>
                  Filter Incomplete Audit →
                </Button>
              </Stack>
            </Box>
          </Inline>
        );
      })()}

      {/* 3. Triage & Investigation Workspace */}
      <Box padding="space.100">
        <Stack space="space.100">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h4">Delivery Integrity Triage</Heading>
            <Badge appearance="primary">{filteredIssues.length} Shown</Badge>
            <Badge appearance="important">{summary?.atRiskIssueCount || 0} At Risk</Badge>
          </Inline>

          {/* Quick View Presets */}
          <Inline space="space.050" alignBlock="center">
            <Text>Quick Views:</Text>
            <Button
              appearance={realityFilter === 'ALL' && riskFilter === 'ALL' ? 'primary' : 'subtle'}
              onClick={() => {
                setRealityFilter('ALL');
                setRiskFilter('ALL');
                setAssigneeFilter('ALL');
                setSprintFilter('ALL');
                setSearchQuery('');
              }}
            >
              All Issues
            </Button>
            <Button
              appearance={realityFilter === 'BLOCKERS' ? 'primary' : 'subtle'}
              onClick={() => setRealityFilter('BLOCKERS')}
            >
              Release Blockers
            </Button>
            <Button
              appearance={realityFilter === 'INTENT' ? 'primary' : 'subtle'}
              onClick={() => setRealityFilter('INTENT')}
            >
              Missing Intent
            </Button>
            <Button
              appearance={realityFilter === 'CODE' ? 'primary' : 'subtle'}
              onClick={() => setRealityFilter('CODE')}
            >
              Unreviewed Code
            </Button>
            <Button
              appearance={realityFilter === 'AUDIT' ? 'primary' : 'subtle'}
              onClick={() => setRealityFilter('AUDIT')}
            >
              Unsealed Audit
            </Button>
          </Inline>

          {/* Filter Toolbar */}
          <Inline space="space.100" alignBlock="center">
            <Box>
              <Textfield
                placeholder="Search key, summary, or finding..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target?.value || '')}
              />
            </Box>
            {(realityFilter !== 'ALL' || riskFilter !== 'ALL' || assigneeFilter !== 'ALL' || sprintFilter !== 'ALL' || searchQuery.trim() !== '') && (
              <Button
                appearance="subtle"
                onClick={() => {
                  setRealityFilter('ALL');
                  setRiskFilter('ALL');
                  setAssigneeFilter('ALL');
                  setSprintFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Clear All Filters ✕
              </Button>
            )}
          </Inline>

          {/* Triage DynamicTable */}
          {filteredIssues.length > 0 ? (
            <DynamicTable
              head={tableHead}
              rows={tableRows}
              rowsPerPage={10}
              defaultPage={1}
              loadingSpinnerSize="small"
              emptyView={<Text>No issues matching filter criteria.</Text>}
            />
          ) : (
            <SectionMessage appearance="information" title="No Matching Issues">
              <Text>No audited issues matched your active search or filter selection.</Text>
            </SectionMessage>
          )}
        </Stack>
      </Box>

      {/* 4. Inspection Modal with Previous / Next navigation */}
      <ModalTransition>
        {selectedIssueModal && (
          <Modal onClose={() => setSelectedIssueModal(null)} width="large">
            <ModalHeader>
              <ModalTitle>
                Delivery Integrity Audit: {selectedIssueModal.issueKey}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Stack space="space.150">
                <Inline space="space.100" alignBlock="center">
                  <Text>{selectedIssueModal.summary || 'Engineering Delivery Item'}</Text>
                  <Lozenge appearance={getRiskAppearance(selectedIssueModal.riskLevel)}>
                    {selectedIssueModal.isEvaluated
                      ? `${selectedIssueModal.realityAlignmentIndex}% ALIGNED (${selectedIssueModal.riskLevel})`
                      : 'EARLY STAGE'}
                  </Lozenge>
                </Inline>

                <Box padding="space.100">
                  <Stack space="space.050">
                    <Text>Evidence Pipeline:</Text>
                    <GatePipeline gates={selectedIssueModal.gates} />
                  </Stack>
                </Box>

                <SectionMessage appearance="warning" title="Primary Diagnostic">
                  <Text>{selectedIssueModal.synthesizedFinding}</Text>
                </SectionMessage>

                {selectedIssueModal.recoverablePoints > 0 && (
                  <Inline space="space.050" alignBlock="center">
                    <Badge appearance="added">+{selectedIssueModal.recoverablePoints} pts recoverable</Badge>
                    <Text>
                      Closing this gate increases issue alignment to{' '}
                      {Math.min(100, selectedIssueModal.realityAlignmentIndex + selectedIssueModal.recoverablePoints)}%.
                    </Text>
                  </Inline>
                )}

                <Text>{selectedIssueModal.whyScoreExplanation}</Text>

                <Heading as="h5">Detailed Reality Findings</Heading>
                {selectedIssueModal.findings.map((f, idx) => (
                  <Text key={idx}>• {f}</Text>
                ))}

                <Heading as="h5">1-Click Gate Remediation</Heading>
                <Inline space="space.100">
                  {selectedIssueModal.gates.intent === 'BLOCKED' && (
                    <Button appearance="primary" onClick={() => openLinkDecisionModal(selectedIssueModal.issueId, selectedIssueModal.issueKey)}>
                      Link Decision (ADR)
                    </Button>
                  )}
                  {selectedIssueModal.gates.code === 'BLOCKED' && (
                    <Button appearance="default" onClick={() => openExceptionModal(selectedIssueModal.issueId, 'CODE')}>
                      Explain: No Code Change
                    </Button>
                  )}
                  {selectedIssueModal.gates.process === 'ATTENTION' && (
                    <Button appearance="default" onClick={() => openExceptionModal(selectedIssueModal.issueId, 'REWORK')}>
                      Add Rework Reason
                    </Button>
                  )}
                  {selectedIssueModal.statusCategory !== 'To Do' && selectedIssueModal.gates.audit !== 'PASSED' && (
                    <>
                      <Button appearance="default" onClick={() => openDoDModal(selectedIssueModal.issueId)}>
                        Review & Complete DoD
                      </Button>
                      {selectedIssueModal.statusCategory === 'Done' && (
                        <Button appearance="default" onClick={() => openSealModal(selectedIssueModal)}>
                          Cryptographic Seal Issue
                        </Button>
                      )}
                    </>
                  )}
                </Inline>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Inline space="space.100" alignBlock="center">
                <Button
                  appearance="subtle"
                  isDisabled={selectedModalIndex <= 0}
                  onClick={() => {
                    if (selectedModalIndex > 0) {
                      setSelectedIssueModal(filteredIssues[selectedModalIndex - 1]);
                    }
                  }}
                >
                  ‹ Prev Issue
                </Button>
                <Button
                  appearance="subtle"
                  isDisabled={selectedModalIndex < 0 || selectedModalIndex >= filteredIssues.length - 1}
                  onClick={() => {
                    if (selectedModalIndex >= 0 && selectedModalIndex < filteredIssues.length - 1) {
                      setSelectedIssueModal(filteredIssues[selectedModalIndex + 1]);
                    }
                  }}
                >
                  Next Issue ›
                </Button>
                <Button appearance="subtle" onClick={() => setSelectedIssueModal(null)}>
                  Close
                </Button>
              </Inline>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </Stack>
  );
};

export default FourRealitiesApp;

ForgeReconciler.render(
  <React.StrictMode>
    <FourRealitiesApp />
  </React.StrictMode>
);
