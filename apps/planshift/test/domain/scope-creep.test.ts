import { ScopeCreepEngine } from '../../src/domain/scope-creep';
import { WbsTask } from '../../src/domain/models';

describe('ScopeCreepEngine', () => {
  const makeTask = (overrides: Partial<WbsTask>): WbsTask => ({
    id: 't-default',
    key: 'DEMO-DEF',
    summary: 'Default Task',
    epic: 'Epic 1',
    story: 'Story 1',
    effortHours: 10,
    resource: 'Dev One',
    progress: 0,
    targetProgress: 0,
    status: 'NOT_STARTED',
    startDate: '2026-11-02',
    endDate: '2026-11-08',
    ...overrides
  } as WbsTask);

  const initialTasks: WbsTask[] = [
    makeTask({
      id: 't-1',
      key: 'DEMO-1',
      summary: 'Auth Setup',
      effortHours: 20,
      startWeek: 'W01',
      endWeek: 'W02',
      spanWeeks: 2,
      resource: 'Dev One',
      status: 'NOT_STARTED'
    }),
    makeTask({
      id: 't-2',
      key: 'DEMO-2',
      summary: 'Data Schema',
      effortHours: 15,
      startWeek: 'W01',
      endWeek: 'W01',
      spanWeeks: 1,
      resource: 'Dev Two',
      status: 'NOT_STARTED'
    })
  ];

  it('freezes a valid commitment baseline', () => {
    const baseline = ScopeCreepEngine.freezeBaseline(
      'plan-1',
      'DEMO',
      'Sprint 1 Commitment',
      'user-123',
      initialTasks
    );

    expect(baseline.baselineId).toBeDefined();
    expect(baseline.planId).toBe('plan-1');
    expect(baseline.projectKey).toBe('DEMO');
    expect(baseline.name).toBe('Sprint 1 Commitment');
    expect(baseline.frozenBy).toBe('user-123');
    expect(baseline.totalCommitmentHours).toBe(35);
    expect(baseline.totalTaskCount).toBe(2);
    expect(baseline.tasks['t-1'].summary).toBe('Auth Setup');
  });

  it('detects scope creep when tasks are added, removed, or expanded', () => {
    const baseline = ScopeCreepEngine.freezeBaseline(
      'plan-1',
      'DEMO',
      'Sprint 1',
      'user-123',
      initialTasks
    );

    // Current tasks: t-1 expanded from 20 to 30h, t-2 removed, t-3 added (10h)
    const modifiedTasks: WbsTask[] = [
      makeTask({
        id: 't-1',
        key: 'DEMO-1',
        summary: 'Auth Setup',
        effortHours: 30,
        startWeek: 'W01',
        endWeek: 'W03',
        spanWeeks: 3,
        resource: 'Dev One',
        progress: 10,
        status: 'IN_PROGRESS'
      }),
      makeTask({
        id: 't-3',
        key: 'DEMO-3',
        summary: 'Surprise Hotfix',
        effortHours: 10,
        startWeek: 'W02',
        endWeek: 'W02',
        spanWeeks: 1,
        resource: 'Dev Three',
        status: 'NOT_STARTED'
      })
    ];

    const report = ScopeCreepEngine.detectScopeCreep(baseline, modifiedTasks);

    expect(report.isCreeping).toBe(true);
    expect(report.baselineHours).toBe(35);
    expect(report.currentHours).toBe(40);
    expect(report.deltaHours).toBe(5);
    expect(report.creepPercentage).toBeCloseTo(14.3, 1);

    expect(report.addedTasks.length).toBe(1);
    expect(report.addedTasks[0].key).toBe('DEMO-3');

    expect(report.removedTasks.length).toBe(1);
    expect(report.removedTasks[0].key).toBe('DEMO-2');

    expect(report.modifiedTasks.length).toBe(1);
    const mod = report.modifiedTasks[0];
    expect(mod.key).toBe('DEMO-1');
    expect(mod.deltaEffort).toBe(10);
    expect(mod.scheduleChanged).toBe(true);
  });

  it('creates and reviews formal shift requests', () => {
    const baseline = ScopeCreepEngine.freezeBaseline(
      'plan-1',
      'DEMO',
      'Sprint 1',
      'lead-user',
      initialTasks
    );

    const expandedTasks = [
      ...initialTasks,
      makeTask({
        id: 't-4',
        key: 'DEMO-4',
        summary: 'Compliance Audit Logging',
        effortHours: 16,
        status: 'NOT_STARTED'
      })
    ];

    const request = ScopeCreepEngine.createShiftRequest(
      baseline,
      expandedTasks,
      'pm-user',
      'Audit requirement from SOC 2 gap analysis'
    );

    expect(request.status).toBe('PENDING');
    expect(request.deltaHours).toBe(16);
    expect(request.addedTaskKeys).toContain('DEMO-4');

    const approved = ScopeCreepEngine.reviewShiftRequest(
      request,
      'APPROVED',
      'director-user',
      'Approved for sprint scope expansion'
    );

    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewedBy).toBe('director-user');
    expect(approved.reviewComment).toBe('Approved for sprint scope expansion');
  });
});
