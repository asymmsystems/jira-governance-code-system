import React, { useState, useEffect } from 'react';
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
  Button
} from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { ProjectAuditSnapshot, IssueIntegrityScore } from '../domain/models';

export const FourRealitiesApp: React.FC = () => {
  const [isIssueView, setIsIssueView] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<ProjectAuditSnapshot | null>(null);
  const [issueScore, setIssueScore] = useState<IssueIntegrityScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMessage(null);
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

  if (loading) {
    return (
      <Inline alignBlock="center">
        <Spinner size="small" />
        <Text>Calculating cross-reality audit metrics...</Text>
      </Inline>
    );
  }

  // Issue-specific Alignment Panel View
  if (isIssueView && issueScore) {
    return (
      <Stack space="space.150">
        {errorMessage && (
          <SectionMessage appearance="error" title="Error">
            <Text>{errorMessage}</Text>
          </SectionMessage>
        )}

        <Box padding="space.100">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h4">Reality Alignment: {issueScore.issueKey}</Heading>
            <Lozenge
              appearance={
                issueScore.riskLevel === 'LOW'
                  ? 'success'
                  : issueScore.riskLevel === 'MEDIUM'
                  ? 'inprogress'
                  : 'removed'
              }
            >
              {issueScore.realityAlignmentIndex}% ALIGNED ({issueScore.riskLevel} RISK)
            </Lozenge>
            <Button appearance="subtle" onClick={init}>Refresh</Button>
          </Inline>
        </Box>

        <Inline space="space.100">
          <Box padding="space.050">
            <Stack space="space.025">
              <Text>Intent: {issueScore.intentScore}%</Text>
              <Text>Process: {issueScore.processScore}%</Text>
            </Stack>
          </Box>
          <Box padding="space.050">
            <Stack space="space.025">
              <Text>Code: {issueScore.codeScore}%</Text>
              <Text>Audit: {issueScore.auditScore}%</Text>
            </Stack>
          </Box>
        </Inline>

        {issueScore.findings.length > 0 && (
          <Box padding="space.050">
            <Stack space="space.050">
              <Heading as="h5">Integrity Findings</Heading>
              {issueScore.findings.map((f, idx) => (
                <Text key={idx}>• {f}</Text>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    );
  }

  // Project-wide Executive Dashboard View
  const summary = snapshot?.summary;

  return (
    <Stack space="space.200">
      {errorMessage && (
        <SectionMessage appearance="error" title="Error">
          <Text>{errorMessage}</Text>
        </SectionMessage>
      )}

      {snapshot?.warning && (
        <SectionMessage appearance="warning" title="Sync Notice">
          <Text>{snapshot.warning}</Text>
        </SectionMessage>
      )}

      <Box padding="space.100">
        <Inline space="space.200" alignBlock="center">
          <Heading as="h3">Reality Alignment Index (RAI)</Heading>
          {(!summary || summary.totalAuditedIssues === 0) ? (
            <Lozenge appearance="default">NO AUDITED ISSUES</Lozenge>
          ) : (
            <Lozenge
              appearance={
                summary.averageRAI >= 80
                  ? 'success'
                  : summary.averageRAI >= 60
                  ? 'inprogress'
                  : 'removed'
              }
            >
              {summary.averageRAI}% ALIGNED
            </Lozenge>
          )}
          <Button appearance="subtle" onClick={init}>
            Refresh
          </Button>
        </Inline>
      </Box>

      {/* Four Reality Metric Cards Row */}
      {(() => {
        const hasAuditedIssues = Boolean(summary && summary.totalAuditedIssues > 0);
        const zeroBounceFlowRate = hasAuditedIssues ? `${100 - summary!.m30ReworkLoopRate}%` : '0%';
        const intentRate = hasAuditedIssues ? `${summary!.m11TraceabilityRate}%` : '0%';
        const codeRate = hasAuditedIssues ? `${summary!.m29ReviewComplianceRate}%` : '0%';
        const auditRate = hasAuditedIssues ? `${summary!.m40AuditComplianceRate}%` : '0%';

        return (
          <Inline space="space.150">
            <Box padding="space.100">
              <Stack space="space.050">
                <Heading as="h4">Intent Reality</Heading>
                <Heading as="h2">{intentRate}</Heading>
                <Text>ADR / Spec Linked</Text>
              </Stack>
            </Box>

            <Box padding="space.100">
              <Stack space="space.050">
                <Heading as="h4">Process Reality</Heading>
                <Heading as="h2">{zeroBounceFlowRate}</Heading>
                <Text>Zero-Bounce Flow</Text>
              </Stack>
            </Box>

            <Box padding="space.100">
              <Stack space="space.050">
                <Heading as="h4">Code Reality</Heading>
                <Heading as="h2">{codeRate}</Heading>
                <Text>Peer Approved PRs</Text>
              </Stack>
            </Box>

            <Box padding="space.100">
              <Stack space="space.050">
                <Heading as="h4">Audit Reality</Heading>
                <Heading as="h2">{auditRate}</Heading>
                <Text>DoD & Seal Gated</Text>
              </Stack>
            </Box>
          </Inline>
        );
      })()}

      {/* At-Risk Issues Section */}
      <Box padding="space.100">
        <Inline space="space.100" alignBlock="center">
          <Heading as="h4">Audited Issues</Heading>
          <Badge appearance="primary">{summary?.totalAuditedIssues || 0}</Badge>
          <Badge appearance="important">{summary?.atRiskIssueCount || 0} At Risk</Badge>
        </Inline>
      </Box>

      {snapshot && snapshot.issueScores.length > 0 ? (
        <Stack space="space.100">
          {snapshot.issueScores.map((issue: IssueIntegrityScore) => (
            <Box key={issue.issueId} padding="space.100">
              <Inline space="space.100" alignBlock="center">
                <Text>{issue.issueKey}</Text>
                <Lozenge
                  appearance={
                    issue.riskLevel === 'LOW'
                      ? 'success'
                      : issue.riskLevel === 'MEDIUM'
                      ? 'inprogress'
                      : 'removed'
                  }
                >
                  {issue.riskLevel} RISK (RAI: {issue.realityAlignmentIndex}%)
                </Lozenge>
              </Inline>
              {issue.findings.length > 0 && (
                <Stack space="space.050">
                  {issue.findings.map((f, idx) => (
                    <Text key={idx}>• {f}</Text>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      ) : (
        <SectionMessage appearance="information" title="Baseline Initialized">
          <Text>
            No active issues audited yet in this project. As Jira issues transition and link Pull Requests,
            FourRealities will track cross-reality delivery integrity automatically.
          </Text>
        </SectionMessage>
      )}
    </Stack>
  );
};

export default FourRealitiesApp;

ForgeReconciler.render(
  <React.StrictMode>
    <FourRealitiesApp />
  </React.StrictMode>
);
