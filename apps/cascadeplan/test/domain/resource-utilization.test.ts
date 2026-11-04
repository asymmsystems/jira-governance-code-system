import { ResourceUtilizationEngine } from '../../src/domain/resource-utilization';
import { WbsTask, WeeklySprintColumn } from '../../src/domain/models';

describe('ResourceUtilizationEngine', () => {
  const mockWeeks: WeeklySprintColumn[] = [
    { weekKey: 'W01', sprintName: 'Week 1', startDate: '2026-11-02', endDate: '2026-11-08' },
    { weekKey: 'W02', sprintName: 'Week 2', startDate: '2026-11-09', endDate: '2026-11-15' },
    { weekKey: 'W03', sprintName: 'Week 3', startDate: '2026-11-16', endDate: '2026-11-22' }
  ];

  const makeTask = (overrides: Partial<WbsTask>): WbsTask => ({
    id: 't-default',
    key: 'DEMO-DEF',
    summary: 'Default Task',
    epic: 'Epic 1',
    story: 'Story 1',
    effortHours: 10,
    resource: 'Alice',
    progress: 0,
    targetProgress: 0,
    status: 'NOT_STARTED',
    startDate: '2026-11-02',
    endDate: '2026-11-08',
    ...overrides
  } as WbsTask);

  it('generates resource allocation grid for assigned and unassigned tasks', () => {
    const tasks: WbsTask[] = [
      makeTask({
        id: 't-1',
        key: 'DEMO-1',
        summary: 'Database Migration',
        resource: 'Alice Engineer',
        startWeek: 'W01',
        endWeek: 'W02',
        spanWeeks: 2,
        effortHours: 40,
        status: 'IN_PROGRESS'
      }),
      makeTask({
        id: 't-2',
        key: 'DEMO-2',
        summary: 'Security Review',
        resource: 'Alice Engineer',
        startWeek: 'W01',
        endWeek: 'W01',
        spanWeeks: 1,
        effortHours: 30,
        status: 'NOT_STARTED'
      }),
      makeTask({
        id: 't-3',
        key: 'DEMO-3',
        summary: 'Backlog Item',
        resource: 'Unassigned',
        startWeek: 'W03',
        endWeek: 'W03',
        spanWeeks: 1,
        effortHours: 16,
        status: 'NOT_STARTED'
      })
    ];

    const result = ResourceUtilizationEngine.generateGrid(tasks, mockWeeks, {
      weeklyCapacityHours: 40,
      currentWeekIndex: 0
    });

    expect(result.resources.length).toBe(1);
    const alice = result.resources[0];
    expect(alice.resourceName).toBe('Alice Engineer');
    // In W01, Alice has 50% from task 1 + 100% from task 2 = 150%
    expect(alice.weeklyUtilization['W01']).toBe(150);
    expect(alice.isOverAllocated).toBe(true);

    // Unassigned task check
    expect(result.unassignedTasks.length).toBe(1);
    expect(result.unassignedTasks[0].key).toBe('DEMO-3');
    expect(result.unassignedTotalHours).toBe(16);

    // Bottlenecks
    expect(result.bottleneckWeeks).toContain('W01');
    expect(result.weeklySummaries['W01'].overAllocatedCount).toBe(1);
  });

  it('handles empty task list gracefully', () => {
    const result = ResourceUtilizationEngine.generateGrid([], mockWeeks);
    expect(result.resources.length).toBe(0);
    expect(result.unassignedTasks.length).toBe(0);
    expect(result.bottleneckWeeks.length).toBe(0);
    expect(result.weeklySummaries['W01'].status).toBe('UNPLANNED');
  });
});
