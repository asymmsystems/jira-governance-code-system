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
  IssueGates
} from '../domain/models';

/**
 * Renders an Atlassian Design System Lozenge for an individual gate status.
 */
export const GatePill: React.FC<{ status: GateStatus; label: string }> = ({ status, label }) => {
  const glyph = status === 'PASSED' ? '●' : status === 'ATTENTION' ? '◐' : status === 'BLOCKED' ? '✕' : '○';
  const appearance =
    status === 'PASSED'
      ? 'success'
      : status === 'ATTENTION'
      ? 'inprogress'
      : status === 'BLOCKED'
      ? 'removed'
      : 'default';

  return (
    <Lozenge appearance={appearance}>
      {glyph} {label}
    </Lozenge>
  );
};

/**
 * Renders the 4-Gate Delivery Pipeline chain (Intent -> Process -> Code -> Audit).
 */
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

/**
 * Compact mini-glyphs for table rows.
 */
export const MiniGateRow: React.FC<{ gates: IssueGates }> = ({ gates }) => {
  const getSymbol = (s: GateStatus) => (s === 'PASSED' ? '●' : s === 'ATTENTION' ? '◐' : s === 'BLOCKED' ? '✕' : '○');
  const getApp = (s: GateStatus) =>
    s === 'PASSED' ? 'success' : s === 'ATTENTION' ? 'inprogress' : s === 'BLOCKED' ? 'removed' : 'default';

  return (
    <Inline space="space.025" alignBlock="center">
      <Lozenge appearance={getApp(gates.intent)}>{getSymbol(gates.intent)}</Lozenge>
      <Lozenge appearance={getApp(gates.process)}>{getSymbol(gates.process)}</Lozenge>
      <Lozenge appearance={getApp(gates.code)}>{getSymbol(gates.code)}</Lozenge>
      <Lozenge appearance={getApp(gates.audit)}>{getSymbol(gates.audit)}</Lozenge>
    </Inline>
  );
};

export const FourRealitiesApp: React.FC = () => {
  const [isIssueView, setIsIssueView] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<ProjectAuditSnapshot | null>(null);
  const [issueScore, setIssueScore] = useState<IssueIntegrityScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Issue Panel state
  const [showAllFindings, setShowAllFindings] = useState<boolean>(false);

  // Project Dashboard Workspace filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [realityFilter, setRealityFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [selectedIssueModal, setSelectedIssueModal] = useState<IssueIntegrityScore | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMessage(null);
    setActionSuccessMessage(null);
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
      setErrorMessage(err?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  // Remediation action handlers
  const handleLinkDecision = async (issueId?: string) => {
    setActionSuccessMessage(null);
    try {
      const targetId = issueId || issueScore?.issueId;
      const res: any = await invoke('linkDecision', { issueId: targetId });
      if (res?.success) {
        setActionSuccessMessage('Architecture Decision (ADR-014) linked successfully. Intent gate verified.');
        await init();
      } else {
        setErrorMessage(res?.error || 'Failed to link decision.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing link decision.');
    }
  };

  const handleSealIssue = async (issueId?: string) => {
    setActionSuccessMessage(null);
    try {
      const targetId = issueId || issueScore?.issueId;
      const res: any = await invoke('sealIssue', { issueId: targetId });
      if (res?.success) {
        setActionSuccessMessage('Issue sealed with cryptographic certificate. Audit gate satisfied.');
        await init();
      } else {
        setErrorMessage(res?.error || 'Failed to seal issue.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing seal issue.');
    }
  };

  const handleCompleteDod = async (issueId?: string) => {
    setActionSuccessMessage(null);
    try {
      const targetId = issueId || issueScore?.issueId;
      const res: any = await invoke('completeDod', { issueId: targetId });
      if (res?.success) {
        setActionSuccessMessage('Definition of Done checklist confirmed. Audit compliance recorded.');
        await init();
      } else {
        setErrorMessage(res?.error || 'Failed to complete DoD.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing complete DoD.');
    }
  };

  if (loading) {
    return (
      <Inline alignBlock="center">
        <Spinner size="small" />
        <Text>Evaluating 4-Gate Delivery Pipeline metrics...</Text>
      </Inline>
    );
  }

  // =========================================================================
  // SURFACE 1: Jira Issue Panel View (Developer-Centric Glanceability)
  // =========================================================================
  if (isIssueView && issueScore) {
    const riskAppearance =
      issueScore.riskLevel === 'LOW'
        ? 'success'
        : issueScore.riskLevel === 'MEDIUM'
        ? 'inprogress'
        : 'removed';

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

        {/* Compact Card Header */}
        <Box padding="space.100">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h4">Delivery Integrity: {issueScore.issueKey}</Heading>
            <Lozenge appearance={riskAppearance}>
              {issueScore.realityAlignmentIndex}% ALIGNED ({issueScore.riskLevel} RISK)
            </Lozenge>
            <Button appearance="subtle" onClick={init}>Refresh</Button>
          </Inline>
        </Box>

        {/* 4-Gate Pipeline Chain */}
        <Box padding="space.100">
          <Stack space="space.100">
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
          </Stack>
        </Box>

        {/* 1-Click Remediation Actions */}
        <Box padding="space.100">
          <Inline space="space.100" alignBlock="center">
            {issueScore.gates.intent === 'BLOCKED' && (
              <Button appearance="primary" onClick={() => handleLinkDecision()}>
                Link Decision (ADR)
              </Button>
            )}
            {issueScore.gates.audit !== 'PASSED' && (
              <>
                <Button appearance="default" onClick={() => handleCompleteDod()}>
                  Complete DoD
                </Button>
                <Button appearance="default" onClick={() => handleSealIssue()}>
                  Seal Issue
                </Button>
              </>
            )}
            <Button appearance="subtle" onClick={() => setShowAllFindings(!showAllFindings)}>
              {showAllFindings ? 'Hide Gate Details ▲' : 'View Gate Details ▾'}
            </Button>
          </Inline>
        </Box>

        {/* Detailed Findings & Score Math */}
        {showAllFindings && (
          <Box padding="space.100">
            <Stack space="space.100">
              <Heading as="h5">Score Breakdown & Evidence</Heading>
              <Text>
                Breakdown: Intent +{Math.round(issueScore.intentScore * 0.25)} · Process +
                {Math.round(issueScore.processScore * 0.25)} · Code +
                {Math.round(issueScore.codeScore * 0.25)} · Audit +
                {Math.round(issueScore.auditScore * 0.25)}
              </Text>
              {issueScore.findings.map((f, idx) => (
                <Text key={idx}>• {f}</Text>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    );
  }

  // =========================================================================
  // SURFACE 2: Project-wide Executive Dashboard & Triage Workspace
  // =========================================================================
  const summary = snapshot?.summary;
  const issues = snapshot?.issueScores || [];

  // Filtered issues calculation for Triage Table
  const filteredIssues = issues.filter(iss => {
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

    return true;
  });

  const avgRAI = summary?.averageRAI || 0;
  const headlineRiskAppearance =
    avgRAI >= 80 ? 'success' : avgRAI >= 60 ? 'inprogress' : 'removed';

  // Dynamic table row formatting
  const tableRows = filteredIssues.map(iss => ({
    key: iss.issueId,
    cells: [
      {
        key: 'key',
        content: <Text>{iss.issueKey}</Text>
      },
      {
        key: 'summary',
        content: <Text>{iss.summary || 'Engineering Delivery Item'}</Text>
      },
      {
        key: 'gates',
        content: <MiniGateRow gates={iss.gates} />
      },
      {
        key: 'rai',
        content: <Text>{iss.realityAlignmentIndex}%</Text>
      },
      {
        key: 'tier',
        content: (
          <Lozenge
            appearance={
              iss.riskLevel === 'LOW'
                ? 'success'
                : iss.riskLevel === 'MEDIUM'
                ? 'inprogress'
                : 'removed'
            }
          >
            {iss.riskLevel}
          </Lozenge>
        )
      },
      {
        key: 'finding',
        content: <Text>{iss.synthesizedFinding}</Text>
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
      { key: 'gates', content: 'Gates' },
      { key: 'rai', content: 'RAI', isSortable: true },
      { key: 'tier', content: 'Risk Tier', isSortable: true },
      { key: 'finding', content: 'Top Diagnostic Finding' },
      { key: 'action', content: 'Action' }
    ]
  };

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
              {avgRAI}% ALIGNED · {summary?.sprintName || 'Sprint 24'}
            </Lozenge>
            {summary && summary.sprintDelta > 0 && (
              <Badge appearance="added">▲ +{summary.sprintDelta} pts vs last sprint</Badge>
            )}
            <Button appearance="subtle" onClick={init}>Refresh Scan</Button>
          </Inline>

          <Inline space="space.150" alignBlock="center">
            <Text>Weakest Gate: {summary?.weakestGate?.toUpperCase() || 'AUDIT'} REALITY</Text>
            <Text>·</Text>
            <Text>Scope: {summary?.totalAuditedIssues || 0} issues audited</Text>
            <Text>·</Text>
            <Text>Biggest mover: Workflow rework loops reduced across sprint</Text>
          </Inline>

          {/* Interactive Risk Distribution Filter Chips */}
          <Inline space="space.050" alignBlock="center">
            <Text>Risk Distribution (Click to filter):</Text>
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

        return (
          <Inline space="space.150">
            {/* Intent Card */}
            <Box padding="space.100">
              <Stack space="space.050">
                <Inline space="space.050" alignBlock="center">
                  <Heading as="h4">◆ Intent</Heading>
                  <Lozenge appearance={intentRate >= 75 ? 'success' : intentRate >= 50 ? 'inprogress' : 'removed'}>
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
                  <Lozenge appearance={processRate >= 75 ? 'success' : processRate >= 50 ? 'inprogress' : 'removed'}>
                    {processRate}%
                  </Lozenge>
                </Inline>
                <Text>Did work flow cleanly?</Text>
                <ProgressBar value={processRate / 100} />
                <Text>
                  {Math.round((processRate / 100) * total)} of {total} zero-bounce issues
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
                  <Lozenge appearance={codeRate >= 75 ? 'success' : codeRate >= 50 ? 'inprogress' : 'removed'}>
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
                  <Lozenge appearance={auditRate >= 75 ? 'success' : auditRate >= 50 ? 'inprogress' : 'removed'}>
                    {auditRate}%
                  </Lozenge>
                </Inline>
                <Text>Proven and sealed?</Text>
                <ProgressBar value={auditRate / 100} />
                <Text>
                  {Math.round((auditRate / 100) * total)} of {total} done issues sealed
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

          {/* Quick View Preset Filters */}
          <Inline space="space.050" alignBlock="center">
            <Text>Quick Views:</Text>
            <Button
              appearance={realityFilter === 'ALL' && riskFilter === 'ALL' ? 'primary' : 'subtle'}
              onClick={() => {
                setRealityFilter('ALL');
                setRiskFilter('ALL');
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
            {(realityFilter !== 'ALL' || riskFilter !== 'ALL' || searchQuery.trim() !== '') && (
              <Button
                appearance="subtle"
                onClick={() => {
                  setRealityFilter('ALL');
                  setRiskFilter('ALL');
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

      {/* 4. Inspection Modal for Row Click */}
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
                  <Lozenge
                    appearance={
                      selectedIssueModal.riskLevel === 'LOW'
                        ? 'success'
                        : selectedIssueModal.riskLevel === 'MEDIUM'
                        ? 'inprogress'
                        : 'removed'
                    }
                  >
                    {selectedIssueModal.realityAlignmentIndex}% ALIGNED ({selectedIssueModal.riskLevel} RISK)
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

                <Heading as="h5">Detailed Reality Findings</Heading>
                {selectedIssueModal.findings.map((f, idx) => (
                  <Text key={idx}>• {f}</Text>
                ))}

                <Heading as="h5">1-Click Gate Remediation</Heading>
                <Inline space="space.100">
                  {selectedIssueModal.gates.intent === 'BLOCKED' && (
                    <Button appearance="primary" onClick={() => handleLinkDecision(selectedIssueModal.issueId)}>
                      Link Architecture Decision (ADR)
                    </Button>
                  )}
                  {selectedIssueModal.gates.audit !== 'PASSED' && (
                    <>
                      <Button appearance="default" onClick={() => handleCompleteDod(selectedIssueModal.issueId)}>
                        Complete DoD Checklist
                      </Button>
                      <Button appearance="default" onClick={() => handleSealIssue(selectedIssueModal.issueId)}>
                        Cryptographic Seal Issue
                      </Button>
                    </>
                  )}
                </Inline>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setSelectedIssueModal(null)}>
                Close
              </Button>
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
