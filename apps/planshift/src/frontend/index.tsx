import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Lozenge,
  SectionMessage,
  Stack,
  Inline,
  Heading,
  Box,
  Spinner,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  DynamicTable,
  Modal,
  ModalTitle,
  ModalBody,
  ModalFooter,
  Textfield,
  Label,
  Select
} from '@forge/react';
import { invoke } from '@forge/bridge';
import {
  ProjectPlanState,
  WbsTask,
  WeeklySprintColumn,
  ResourceUtilizationProfile,
  PortfolioResourceHeatmapRow,
  TaskDependency,
  CURRENT_WEEK_INDEX
} from '../domain/models';
import { PlannerEngine } from '../domain/planner-engine';


export const PlanShiftApp: React.FC = () => {
  const [plan, setPlan] = useState<ProjectPlanState | null>(null);
  const [portfolioRows, setPortfolioRows] = useState<PortfolioResourceHeatmapRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters for View 3
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterCoe, setFilterCoe] = useState<string>('ALL');
  const [filterVertical, setFilterVertical] = useState<string>('ALL');

  // Modal dialog states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDepModal, setShowDepModal] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Form inputs
  const [newSummary, setNewSummary] = useState<string>('');
  const [newEpic, setNewEpic] = useState<string>('Epic 1');
  const [newStory, setNewStory] = useState<string>('Story 1');
  const [newEffort, setNewEffort] = useState<string>('40');
  const [newResource, setNewResource] = useState<string>('Resource 1');
  const [newStartDate, setNewStartDate] = useState<string>('2026-08-26');
  const [newEndDate, setNewEndDate] = useState<string>('2026-09-16');

  // Dependency form
  const [depPredecessorKey, setDepPredecessorKey] = useState<string>('');
  const [depTriggerPercent, setDepTriggerPercent] = useState<string>('30');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const planData = await invoke<ProjectPlanState>('getProjectPlan', {});
      if (planData) {
        setPlan(planData as ProjectPlanState);
      }
      const heatmapData: any = await invoke('getPortfolioResourceHeatmap', {
        filters: { project: filterProject, coe: filterCoe, vertical: filterVertical }
      });
      if (heatmapData?.rows) {
        setPortfolioRows(heatmapData.rows);
      }
    } catch (err: any) {
      console.error('PlanShift: Load failed', err);
      setErrorMessage(err?.message || 'Failed to load project plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newSummary.trim()) return;
    setLoading(true);
    try {
      await invoke('createInlineTask', {
        summary: newSummary,
        epic: newEpic,
        story: newStory,
        effortHours: Number(newEffort) || 40,
        resource: newResource,
        startDate: newStartDate,
        endDate: newEndDate
      });
      setShowCreateModal(false);
      setNewSummary('');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create task.');
      setLoading(false);
    }
  };

  const handleSaveDependency = async () => {
    if (!selectedTaskId || !depPredecessorKey.trim()) return;
    setLoading(true);
    try {
      await invoke('saveTaskDependency', {
        taskId: selectedTaskId,
        dependency: {
          predecessorId: depPredecessorKey,
          predecessorKey: depPredecessorKey,
          triggerPercent: Number(depTriggerPercent) || 30,
          isTriggerSatisfied: false
        }
      });
      setShowDepModal(false);
      setSelectedTaskId(null);
      setDepPredecessorKey('');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to link dependency.');
      setLoading(false);
    }
  };

  if (loading && !plan) {
    return (
      <Box padding="space.300">
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" />
          <Text>Loading PlanShift Project Workspace...</Text>
        </Inline>
      </Box>
    );
  }

  const tasks: WbsTask[] = plan?.tasks || [];
  const weeks: WeeklySprintColumn[] = plan?.weeks || [];
  const resourceProfiles: ResourceUtilizationProfile[] =
    tasks.length > 0 && weeks.length > 0
      ? PlannerEngine.calculateResourceUtilization(tasks, weeks, CURRENT_WEEK_INDEX)
      : [];
  const overallCompletion = PlannerEngine.calculateProjectCompletion(tasks);

  // Tab 1 DynamicTable configuration
  const trackingHead = {
    cells: [
      { key: 'epic', content: 'Epic' },
      { key: 'story', content: 'Story' },
      { key: 'task', content: 'Task' },
      { key: 'hrs', content: 'Hrs' },
      { key: 'resource', content: 'Resource' },
      { key: 'progress', content: 'Progress' },
      { key: 'target', content: 'Target' },
      { key: 'status', content: 'Status' },
      ...weeks.map(w => ({
        key: w.weekKey,
        content: w.weekKey
      })),
      { key: 'action', content: 'Action' }
    ]
  };

  const trackingRows = tasks.map(t => ({
    key: t.id,
    cells: [
      { key: 'epic', content: <Text>{t.epic}</Text> },
      { key: 'story', content: <Text>{t.story}</Text> },
      {
        key: 'task',
        content: (
          <Stack space="space.025">
            <Text>{t.key}: {t.summary}</Text>
            {t.dependency && (
              <Lozenge appearance={t.dependency.isTriggerSatisfied ? 'success' : 'moved'}>
                Dep: {t.dependency.predecessorKey} &gt;= {t.dependency.triggerPercent}%
              </Lozenge>
            )}
          </Stack>
        )
      },
      { key: 'hrs', content: <Text>{t.effortHours}h</Text> },
      { key: 'resource', content: <Text>{t.resource}</Text> },
      { key: 'progress', content: <Text>{t.progress}%</Text> },
      { key: 'target', content: <Text>{t.targetProgress}%</Text> },
      {
        key: 'status',
        content: (
          <Lozenge
            appearance={
              t.status === 'COMPLETED'
                ? 'success'
                : t.status === 'IN_PROGRESS'
                ? 'inprogress'
                : 'default'
            }
          >
            {t.status}
          </Lozenge>
        )
      },
      ...weeks.map((w, wIdx) => {
        const state = PlannerEngine.calculateCellVisualState(t, w, wIdx, CURRENT_WEEK_INDEX);
        return {
          key: w.weekKey,
          content: (
            <Box>
              {state === 'COMPLETED' && <Lozenge appearance="success">Done</Lozenge>}
              {state === 'BEHIND_SCHEDULE' && <Lozenge appearance="removed">Lag</Lozenge>}
              {state === 'PLANNED_LEFT' && <Lozenge appearance="inprogress">Plan</Lozenge>}
              {state === 'EMPTY' && <Text>-</Text>}
            </Box>
          )
        };
      }),
      {
        key: 'action',
        content: (
          <Button
            appearance="subtle"
            onClick={() => {
              setSelectedTaskId(t.id);
              setShowDepModal(true);
            }}
          >
            Dep
          </Button>
        )
      }
    ]
  }));

  // Tab 3 DynamicTable configuration
  const portfolioHead = {
    cells: [
      { key: 'resource', content: 'Resource' },
      { key: 'project', content: 'Project' },
      { key: 'coe', content: 'CoE' },
      { key: 'vertical', content: 'Vertical' },
      ...weeks.map(w => ({
        key: w.weekKey,
        content: w.weekKey
      }))
    ]
  };

  const portfolioTableRows = portfolioRows.map(row => ({
    key: row.resourceId,
    cells: [
      { key: 'resource', content: <Text>{row.resourceName}</Text> },
      { key: 'project', content: <Text>{row.project}</Text> },
      { key: 'coe', content: <Text>{row.coe}</Text> },
      { key: 'vertical', content: <Text>{row.vertical}</Text> },
      ...weeks.map(w => {
        const load = row.weeklyUtilization[w.weekKey] || 0;
        const st = row.weeklyState[w.weekKey];
        return {
          key: w.weekKey,
          content: (
            <Lozenge
              appearance={
                st === 'PAST_UTILIZED'
                  ? 'success'
                  : st === 'FUTURE_PLANNED'
                  ? 'inprogress'
                  : st === 'UNPLANNED'
                  ? 'moved'
                  : 'removed'
              }
            >
              {load}%
            </Lozenge>
          )
        };
      })
    ]
  }));

  return (
    <Stack space="space.200">
      {/* Top Banner & Header */}
      <Box padding="space.100">
        <Inline space="space.200" alignBlock="center">
          <Heading as="h2">PlanShift - Adaptive Project &amp; Resource Portfolio</Heading>
          <Lozenge appearance="inprogress">Project: {plan?.projectKey || 'DEMO'}</Lozenge>
          <Lozenge appearance="success">Completion: {overallCompletion.actualCompletion}%</Lozenge>
          <Button appearance="primary" onClick={() => setShowCreateModal(true)}>
            + Add Task / Issue
          </Button>
          <Button appearance="subtle" onClick={loadData}>
            Refresh
          </Button>
        </Inline>
      </Box>

      {errorMessage && (
        <SectionMessage appearance="error">
          <Text>{errorMessage}</Text>
        </SectionMessage>
      )}

      {/* Main Tabs matching User Mockups */}
      <Tabs id="planshift-main-tabs">
        <TabList>
          <Tab>1. Project Tracking View (WBS &amp; Timeline)</Tab>
          <Tab>2. Resource Utilization View (Per-Person)</Tab>
          <Tab>3. Resource Planning View (Executive Heatmap)</Tab>
        </TabList>

        {/* TAB 1: Project Tracking View */}
        <TabPanel>
          <Stack space="space.150">
            <Box padding="space.050">
              <Inline space="space.150">
                <Text>Legend: </Text>
                <Lozenge appearance="success">Green: Completed / On Track</Lozenge>
                <Lozenge appearance="removed">Red: Behind Schedule</Lozenge>
                <Lozenge appearance="inprogress">Blue: Planned Remaining</Lozenge>
                <Lozenge appearance="default">| Current Week: 26-Aug</Lozenge>
              </Inline>
            </Box>

            <DynamicTable head={trackingHead} rows={trackingRows} />
          </Stack>
        </TabPanel>

        {/* TAB 2: Resource Utilization View */}
        <TabPanel>
          <Stack space="space.150">
            <Box padding="space.050">
              <Inline space="space.150">
                <Text>Legend: </Text>
                <Lozenge appearance="success">100% Balanced Past</Lozenge>
                <Lozenge appearance="removed">&lt;100% Under-utilized / Delay</Lozenge>
                <Lozenge appearance="inprogress">100% Future Planned</Lozenge>
                <Lozenge appearance="moved">0% Unplanned / Bench</Lozenge>
              </Inline>
            </Box>

            {resourceProfiles.map(p => {
              const profileHead = {
                cells: [
                  { key: 'project', content: 'Project' },
                  { key: 'epic', content: 'Epic' },
                  { key: 'task', content: 'Task' },
                  { key: 'status', content: 'Status' },
                  ...weeks.map(w => ({
                    key: w.weekKey,
                    content: w.weekKey
                  }))
                ]
              };

              const profileRows = [
                ...p.allocations.map((alloc, aIdx) => ({
                  key: `alloc-${aIdx}`,
                  cells: [
                    { key: 'project', content: <Text>{alloc.projectName}</Text> },
                    { key: 'epic', content: <Text>{alloc.epic}</Text> },
                    { key: 'task', content: <Text>{alloc.task}</Text> },
                    { key: 'status', content: <Text>{alloc.status}</Text> },
                    ...weeks.map(w => ({
                      key: w.weekKey,
                      content: <Text>{alloc.weeklyWorkload[w.weekKey] || 0}%</Text>
                    }))
                  ]
                })),
                {
                  key: 'total',
                  cells: [
                    { key: 'project', content: <Text>TOTAL UTILIZATION</Text> },
                    { key: 'epic', content: <Text>-</Text> },
                    { key: 'task', content: <Text>Rollup</Text> },
                    { key: 'status', content: <Text>-</Text> },
                    ...weeks.map(w => {
                      const total = p.overallWeeklyUtilization[w.weekKey] || 0;
                      const state = p.overallWeeklyState[w.weekKey];
                      return {
                        key: w.weekKey,
                        content: (
                          <Lozenge
                            appearance={
                              state === 'PAST_UTILIZED'
                                ? 'success'
                                : state === 'FUTURE_PLANNED'
                                ? 'inprogress'
                                : state === 'UNPLANNED'
                                ? 'moved'
                                : 'removed'
                            }
                          >
                            {total}%
                          </Lozenge>
                        )
                      };
                    })
                  ]
                }
              ];

              return (
                <Box key={p.resourceName} padding="space.100">
                  <Stack space="space.050">
                    <Heading as="h4">{p.resourceName} Multi-Project Workload</Heading>
                    <DynamicTable head={profileHead} rows={profileRows} />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </TabPanel>

        {/* TAB 3: Resource Planning View (Executive Heatmap) */}
        <TabPanel>
          <Stack space="space.150">
            <Box padding="space.050">
              <Inline space="space.150" alignBlock="center">
                <Text>Filters: </Text>
                <Label labelFor="filter-project">Project</Label>
                <Select
                  id="filter-project"
                  value={{ label: filterProject, value: filterProject }}
                  onChange={(opt: any) => {
                    setFilterProject(opt.value);
                    loadData();
                  }}
                  options={[
                    { label: 'ALL Projects', value: 'ALL' },
                    { label: 'Project 1', value: 'Project 1' },
                    { label: 'Project 2', value: 'Project 2' },
                    { label: 'Project 3', value: 'Project 3' }
                  ]}
                />
                <Label labelFor="filter-coe">CoE</Label>
                <Select
                  id="filter-coe"
                  value={{ label: filterCoe, value: filterCoe }}
                  onChange={(opt: any) => {
                    setFilterCoe(opt.value);
                    loadData();
                  }}
                  options={[
                    { label: 'ALL CoEs', value: 'ALL' },
                    { label: 'Backend & Cloud', value: 'Backend & Cloud' },
                    { label: 'Frontend & UI/UX', value: 'Frontend & UI/UX' },
                    { label: 'QA Automation', value: 'QA Automation' }
                  ]}
                />
              </Inline>
            </Box>

            <DynamicTable head={portfolioHead} rows={portfolioTableRows} />
          </Stack>
        </TabPanel>
      </Tabs>

      {/* Create Task Modal Dialog */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <ModalTitle>Add Task (Auto-Create Jira Ticket)</ModalTitle>
          <ModalBody>
            <Stack space="space.100">
              <Label labelFor="summary">Task Summary</Label>
              <Textfield
                id="summary"
                name="summary"
                placeholder="e.g. Integrate Redis Cache"
                value={newSummary}
                onChange={(e: any) => setNewSummary(e.target.value)}
              />
              <Label labelFor="epic">Epic</Label>
              <Textfield
                id="epic"
                name="epic"
                defaultValue={newEpic}
                onChange={(e: any) => setNewEpic(e.target.value)}
              />
              <Label labelFor="story">User Story</Label>
              <Textfield
                id="story"
                name="story"
                defaultValue={newStory}
                onChange={(e: any) => setNewStory(e.target.value)}
              />
              <Label labelFor="effort">Effort Hours</Label>
              <Textfield
                id="effort"
                name="effort"
                defaultValue={newEffort}
                onChange={(e: any) => setNewEffort(e.target.value)}
              />
              <Label labelFor="resource">Assigned Resource</Label>
              <Textfield
                id="resource"
                name="resource"
                defaultValue={newResource}
                onChange={(e: any) => setNewResource(e.target.value)}
              />
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button appearance="primary" onClick={handleCreateTask}>Create Jira Ticket</Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Configure Partial Completion Dependency Modal */}
      {showDepModal && (
        <Modal onClose={() => setShowDepModal(false)}>
          <ModalTitle>Configure Partial Completion Dependency</ModalTitle>
          <ModalBody>
            <Stack space="space.100">
              <Text>Target Task ID: {selectedTaskId}</Text>
              <Label labelFor="predKey">Predecessor Task Key / ID</Label>
              <Textfield
                id="predKey"
                name="predKey"
                placeholder="e.g. DEMO-106"
                value={depPredecessorKey}
                onChange={(e: any) => setDepPredecessorKey(e.target.value)}
              />
              <Label labelFor="thresh">Trigger Progress Threshold (%)</Label>
              <Textfield
                id="thresh"
                name="thresh"
                placeholder="e.g. 30"
                value={depTriggerPercent}
                onChange={(e: any) => setDepTriggerPercent(e.target.value)}
              />
              <Text>Rule: Target task can commence as soon as predecessor reaches {depTriggerPercent}% completion.</Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={() => setShowDepModal(false)}>Cancel</Button>
            <Button appearance="primary" onClick={handleSaveDependency}>Save Milestone Dependency</Button>
          </ModalFooter>
        </Modal>
      )}
    </Stack>
  );
};

export default PlanShiftApp;

ForgeReconciler.render(
  <React.StrictMode>
    <PlanShiftApp />
  </React.StrictMode>
);
