import { PlannerEngine } from '../../src/domain/planner-engine';
import {
  WbsTask,
  WeeklySprintColumn,
  TaskDependency,
  toWorkEffort,
  fromWorkEffort,
  WorkEffort,
  WorkEffortAssoc,
  WorkEffortPartyAssignment
} from '../../src/domain/models';

describe('PlannerEngine Domain Tests', () => {
  const sampleWeek: WeeklySprintColumn = {
    weekKey: '15-Jul',
    sprintName: 'Sprint 0',
    startDate: '2026-07-15',
    endDate: '2026-07-21'
  };

  const futureWeek: WeeklySprintColumn = {
    weekKey: '16-Sep',
    sprintName: 'Sprint 3',
    startDate: '2026-09-16',
    endDate: '2026-09-22'
  };

  const sampleTask: WbsTask = {
    id: 'T-1',
    key: 'DEMO-1',
    summary: 'Infra setup',
    epic: 'Infra',
    story: 'Core',
    effortHours: 40,
    resource: 'Alice',
    progress: 50,
    targetProgress: 30,
    status: 'IN_PROGRESS',
    startDate: '2026-07-15',
    endDate: '2026-09-20',
    weeklyAllocations: { '15-Jul': 50 }
  };

  describe('calculateCellVisualState', () => {
    it('returns EMPTY when week is outside task date range and has no allocation', () => {
      const outOfRangeWeek: WeeklySprintColumn = {
        weekKey: '01-Jan',
        sprintName: 'Pre',
        startDate: '2026-01-01',
        endDate: '2026-01-07'
      };
      const res = PlannerEngine.calculateCellVisualState(sampleTask, outOfRangeWeek, 0, 5);
      expect(res).toBe('EMPTY');
    });

    it('returns PLANNED_LEFT in past week when progress >= targetProgress but < 100', () => {
      const res = PlannerEngine.calculateCellVisualState(sampleTask, sampleWeek, 0, 5);
      expect(res).toBe('PLANNED_LEFT');
    });

    it('returns COMPLETED in past week when task status is COMPLETED or progress is 100', () => {
      const completedTask: WbsTask = { ...sampleTask, status: 'COMPLETED', progress: 100 };
      const res = PlannerEngine.calculateCellVisualState(completedTask, sampleWeek, 0, 5);
      expect(res).toBe('COMPLETED');
    });

    it('returns BEHIND_SCHEDULE in past week when progress < targetProgress', () => {
      const delayedTask: WbsTask = { ...sampleTask, progress: 10, targetProgress: 40 };
      const res = PlannerEngine.calculateCellVisualState(delayedTask, sampleWeek, 0, 5);
      expect(res).toBe('BEHIND_SCHEDULE');
    });

    it('returns BEHIND_SCHEDULE in past week when progress is 0', () => {
      const zeroProgressTask: WbsTask = { ...sampleTask, progress: 0, targetProgress: 0 };
      const res = PlannerEngine.calculateCellVisualState(zeroProgressTask, sampleWeek, 0, 5);
      expect(res).toBe('BEHIND_SCHEDULE');
    });

    it('returns PLANNED_LEFT in future week when task has remaining work', () => {
      const res = PlannerEngine.calculateCellVisualState(sampleTask, futureWeek, 10, 5);
      expect(res).toBe('PLANNED_LEFT');
    });

    it('returns COMPLETED in future week if task is already completed', () => {
      const doneTask: WbsTask = { ...sampleTask, status: 'COMPLETED', progress: 100 };
      const res = PlannerEngine.calculateCellVisualState(doneTask, futureWeek, 10, 5);
      expect(res).toBe('COMPLETED');
    });
  });

  describe('validateDependency', () => {
    it('approves a valid non-cyclical dependency with valid threshold', () => {
      const res = PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', 40, []);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('allows boundary thresholds of 0% and 100%', () => {
      expect(PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', 0, []).valid).toBe(true);
      expect(PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', 100, []).valid).toBe(true);
    });

    it('rejects invalid threshold values (< 0, > 100, NaN)', () => {
      expect(PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', -5, []).valid).toBe(false);
      expect(PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', 105, []).valid).toBe(false);
      expect(PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', NaN, []).valid).toBe(false);
    });

    it('rejects self-dependency', () => {
      const res = PlannerEngine.validateDependency('DEMO-1', 'DEMO-1', 30, []);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot depend on itself');
    });

    it('detects and rejects direct two-task cyclic dependencies (A -> B -> A)', () => {
      const tasks = [
        { key: 'DEMO-1', dependency: { predecessorKey: 'DEMO-2' } as any }
      ];
      const res = PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', 50, tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Cyclic dependency detected');
    });

    it('detects and rejects multi-hop cyclic dependencies (A -> B -> C -> A)', () => {
      const tasks = [
        { key: 'DEMO-1', dependency: { predecessorKey: 'DEMO-2' } as any },
        { key: 'DEMO-2', dependency: { predecessorKey: 'DEMO-3' } as any }
      ];
      const res = PlannerEngine.validateDependency('DEMO-3', 'DEMO-1', 50, tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Cyclic dependency detected');
    });

    it('handles visited loop in predecessor chain that does not reach successor', () => {
      const tasks = [
        { key: 'DEMO-1', dependency: { predecessorKey: 'DEMO-2' } as any },
        { key: 'DEMO-2', dependency: { predecessorKey: 'DEMO-2' } as any } // loop on DEMO-2
      ];
      const res = PlannerEngine.validateDependency('DEMO-99', 'DEMO-1', 50, tasks);
      expect(res.valid).toBe(true);
    });
  });

  describe('generateDynamicWeeks', () => {
    it('generates expected count of rolling sprint columns around reference date', () => {
      const { weeks, currentWeekIndex } = PlannerEngine.generateDynamicWeeks(new Date('2026-10-30'), 4, 6);
      expect(weeks.length).toBe(11);
      expect(currentWeekIndex).toBe(4);
      expect(weeks[currentWeekIndex].isCurrentWeek).toBe(true);
      expect(weeks[0].isCurrentWeek).toBe(false);
      expect(weeks[weeks.length - 1].isCurrentWeek).toBe(false);
    });

    it('generates standard 15-week window with default parameters', () => {
      const { weeks, currentWeekIndex } = PlannerEngine.generateDynamicWeeks();
      expect(weeks.length).toBe(15);
      expect(currentWeekIndex).toBe(6);
      expect(weeks[6].isCurrentWeek).toBe(true);
    });

    it('calculates Wednesday alignment properly when reference date is earlier in the week (e.g. Sunday or Monday)', () => {
      const { weeks } = PlannerEngine.generateDynamicWeeks(new Date('2026-10-25'), 2, 2);
      expect(weeks.length).toBe(5);
    });
  });

  describe('calculateProjectCompletion', () => {
    it('returns 0, 0 when task list is empty', () => {
      const res = PlannerEngine.calculateProjectCompletion([]);
      expect(res.actualCompletion).toBe(0);
      expect(res.targetCompletion).toBe(0);
    });

    it('calculates weighted actual and target completion correctly', () => {
      const tasks: WbsTask[] = [
        { ...sampleTask, effortHours: 10, progress: 100, targetProgress: 100 },
        { ...sampleTask, effortHours: 10, progress: 50, targetProgress: 50 }
      ];
      const res = PlannerEngine.calculateProjectCompletion(tasks);
      expect(res.actualCompletion).toBe(75);
      expect(res.targetCompletion).toBe(75);
    });

    it('defaults effortHours to 1 if effortHours is 0 or negative', () => {
      const tasks: WbsTask[] = [
        { ...sampleTask, effortHours: 0, progress: 80, targetProgress: 80 }
      ];
      const res = PlannerEngine.calculateProjectCompletion(tasks);
      expect(res.actualCompletion).toBe(80);
    });
  });

  describe('calculateResourceUtilization', () => {
    const weeks: WeeklySprintColumn[] = [sampleWeek, futureWeek];

    it('aggregates multiple tasks per resource and assigns correct utilization states', () => {
      const tasks: WbsTask[] = [
        {
          ...sampleTask,
          resource: 'Bob',
          weeklyAllocations: { '15-Jul': 100, '16-Sep': 100 }
        },
        {
          ...sampleTask,
          id: 'T-2',
          resource: 'Charlie',
          weeklyAllocations: { '15-Jul': 50, '16-Sep': 0 }
        },
        {
          ...sampleTask,
          id: 'T-3',
          resource: 'David',
          weeklyAllocations: { '15-Jul': 120, '16-Sep': 50 }
        }
      ];

      const profiles = PlannerEngine.calculateResourceUtilization(tasks, weeks, 0, 'Alpha Project');
      expect(profiles).toHaveLength(3);

      const bob = profiles.find(p => p.resourceName === 'Bob');
      expect(bob?.overallWeeklyUtilization['15-Jul']).toBe(100);
      expect(bob?.overallWeeklyState['15-Jul']).toBe('PAST_UTILIZED');
      expect(bob?.overallWeeklyUtilization['16-Sep']).toBe(100);
      expect(bob?.overallWeeklyState['16-Sep']).toBe('FUTURE_PLANNED');

      const charlie = profiles.find(p => p.resourceName === 'Charlie');
      expect(charlie?.overallWeeklyUtilization['15-Jul']).toBe(50);
      expect(charlie?.overallWeeklyState['15-Jul']).toBe('UNDER_UTILIZED');
      expect(charlie?.overallWeeklyUtilization['16-Sep']).toBe(0);
      expect(charlie?.overallWeeklyState['16-Sep']).toBe('UNPLANNED');

      const david = profiles.find(p => p.resourceName === 'David');
      expect(david?.overallWeeklyUtilization['15-Jul']).toBe(120);
      expect(david?.overallWeeklyState['15-Jul']).toBe('OVER_ALLOCATED');
      expect(david?.overallWeeklyUtilization['16-Sep']).toBe(50);
      expect(david?.overallWeeklyState['16-Sep']).toBe('UNDER_UTILIZED');
    });

    it('falls back to default allocation calculation if weeklyAllocations is not specified', () => {
      const taskNoAlloc: WbsTask = {
        ...sampleTask,
        weeklyAllocations: undefined
      };
      const profiles = PlannerEngine.calculateResourceUtilization([taskNoAlloc], weeks, 0);
      expect(profiles[0].allocations[0].weeklyWorkload['15-Jul']).toBeGreaterThan(0);
    });

    it('allocates workload evenly across startWeek and endWeek if weeklyAllocations is undefined', () => {
      const taskWithWeeks: WbsTask = {
        ...sampleTask,
        startWeek: '15-Jul',
        endWeek: '16-Sep',
        weeklyAllocations: undefined
      };
      const profiles = PlannerEngine.calculateResourceUtilization([taskWithWeeks], weeks, 0);
      expect(profiles[0].allocations[0].weeklyWorkload['15-Jul']).toBe(50);
      expect(profiles[0].allocations[0].weeklyWorkload['16-Sep']).toBe(50);
    });

    it('computes end index from span when endWeek is undefined', () => {
      const taskNoEndWeek: WbsTask = {
        ...sampleTask,
        startWeek: '15-Jul',
        endWeek: undefined,
        spanWeeks: 1,
        weeklyAllocations: undefined
      };
      const profiles = PlannerEngine.calculateResourceUtilization([taskNoEndWeek], weeks, 0);
      expect(profiles[0].allocations[0].weeklyWorkload['15-Jul']).toBe(100);
    });

    it('assigns Unassigned when task resource is empty or whitespace', () => {
      const unassignedTask: WbsTask = {
        ...sampleTask,
        resource: ''
      };
      const profiles = PlannerEngine.calculateResourceUtilization([unassignedTask], weeks, 0);
      expect(profiles[0].resourceName).toBe('Unassigned');
    });

    it('sets workload to 0 when task has no weekly allocations, week keys, or date range', () => {
      const taskNoDates: WbsTask = {
        ...sampleTask,
        startWeek: undefined,
        endWeek: undefined,
        startDate: undefined as any,
        endDate: undefined as any,
        weeklyAllocations: undefined
      };
      const profiles = PlannerEngine.calculateResourceUtilization([taskNoDates], weeks, 0);
      expect(profiles[0].allocations[0].weeklyWorkload['15-Jul']).toBe(0);
    });
  });

  describe('buildPortfolioHeatmap and filterPortfolioHeatmap', () => {
    it('builds portfolio rows using metadata and applies filters', () => {
      const weeks: WeeklySprintColumn[] = [sampleWeek, futureWeek];
      const profiles = PlannerEngine.calculateResourceUtilization([sampleTask], weeks, 0);

      const metadata = {
        Alice: { coe: 'Frontend', vertical: 'Fintech', project: 'Project 1' }
      };

      const rows = PlannerEngine.buildPortfolioHeatmap(profiles, metadata);
      expect(rows).toHaveLength(1);
      expect(rows[0].coe).toBe('Frontend');
      expect(rows[0].vertical).toBe('Fintech');

      // Filtering tests
      const filteredAll = PlannerEngine.filterPortfolioHeatmap(rows, { project: 'ALL', coe: 'ALL', vertical: 'ALL' });
      expect(filteredAll).toHaveLength(1);

      const filteredMatch = PlannerEngine.filterPortfolioHeatmap(rows, { project: 'Project 1', coe: 'Frontend' });
      expect(filteredMatch).toHaveLength(1);

      const filteredMismatch = PlannerEngine.filterPortfolioHeatmap(rows, { project: 'Project 99' });
      expect(filteredMismatch).toHaveLength(0);

      const filteredCoeMismatch = PlannerEngine.filterPortfolioHeatmap(rows, { coe: 'Backend' });
      expect(filteredCoeMismatch).toHaveLength(0);

      const filteredVertMismatch = PlannerEngine.filterPortfolioHeatmap(rows, { vertical: 'Health' });
      expect(filteredVertMismatch).toHaveLength(0);
    });

    it('provides fallback metadata when resource is missing from metadataMap', () => {
      const weeks: WeeklySprintColumn[] = [sampleWeek];
      const profiles = PlannerEngine.calculateResourceUtilization([{ ...sampleTask, resource: 'UnknownDev' }], weeks, 0);
      const rows = PlannerEngine.buildPortfolioHeatmap(profiles, {});
      expect(rows[0].coe).toBe('Core Engineering');
    });
  });

  describe('normalizeEstimateToHours', () => {
    it('normalizes HOURS value directly', () => {
      expect(PlannerEngine.normalizeEstimateToHours('HOURS', 24)).toBe(24);
      expect(PlannerEngine.normalizeEstimateToHours('HOURS', -5)).toBe(0);
    });

    it('normalizes STORY_POINTS with default and custom ratios', () => {
      expect(PlannerEngine.normalizeEstimateToHours('STORY_POINTS', 5)).toBe(40);
      expect(PlannerEngine.normalizeEstimateToHours('STORY_POINTS', 3, undefined, 6)).toBe(18);
    });

    it('normalizes TSHIRT sizes correctly', () => {
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, 'XS')).toBe(4);
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, 'S')).toBe(8);
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, 'M')).toBe(16);
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, 'L')).toBe(32);
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, 'XL')).toBe(64);
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, undefined)).toBe(16);
    });

    it('handles unexpected unit fallback and default arguments', () => {
      expect(PlannerEngine.normalizeEstimateToHours('CUSTOM' as any, 12)).toBe(12);
      expect(PlannerEngine.normalizeEstimateToHours('HOURS')).toBe(0);
      expect(PlannerEngine.normalizeEstimateToHours('TSHIRT', 0, 'UNKNOWN' as any)).toBe(16);
    });
  });

  describe('calculateEffortWithSubtasksAndBuffer', () => {
    it('applies complete defaults when empty config is provided', () => {
      const effort = PlannerEngine.calculateEffortWithSubtasksAndBuffer({});
      expect(effort.unit).toBe('HOURS');
      expect(effort.rawEstimate).toBe(40);
      expect(effort.totalCalculatedHours).toBe(40);
      expect(effort.bufferHours).toBe(0);
    });

    it('calculates effort without subtasks from raw estimate', () => {
      const effort = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
        unit: 'HOURS',
        rawEstimate: 40,
        bufferType: 'NONE'
      });
      expect(effort.totalCalculatedHours).toBe(40);
      expect(effort.bufferHours).toBe(0);
    });

    it('sums subtask normalized hours and applies PERCENTAGE buffer', () => {
      const effort = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
        subtasks: [
          { id: 's1', summary: 'DB', estimateValue: 10, estimateUnit: 'HOURS', normalizedHours: 10, status: 'NOT_STARTED' },
          { id: 's2', summary: 'API', estimateValue: 20, estimateUnit: 'HOURS', normalizedHours: 20, status: 'NOT_STARTED' }
        ],
        bufferType: 'PERCENTAGE',
        bufferValue: 20
      });
      expect(effort.subtasksSumHours).toBe(30);
      expect(effort.bufferHours).toBe(6);
      expect(effort.totalCalculatedHours).toBe(36);
    });

    it('applies FIXED_HOURS buffer', () => {
      const effort = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
        unit: 'HOURS',
        rawEstimate: 30,
        bufferType: 'FIXED_HOURS',
        bufferValue: 10
      });
      expect(effort.bufferHours).toBe(10);
      expect(effort.totalCalculatedHours).toBe(40);
    });

    it('handles subtasks with undefined normalizedHours', () => {
      const effort = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
        subtasks: [
          { id: 's0', summary: 'Zero', estimateValue: 0, estimateUnit: 'HOURS', normalizedHours: undefined as any, status: 'NOT_STARTED' }
        ]
      });
      expect(effort.subtasksSumHours).toBe(0);
      expect(effort.totalCalculatedHours).toBe(40);
    });
  });

  describe('reorderTasks', () => {
    const t1: WbsTask = { ...sampleTask, key: 'T-1', id: '1' };
    const t2: WbsTask = { ...sampleTask, key: 'T-2', id: '2' };
    const t3: WbsTask = { ...sampleTask, key: 'T-3', id: '3' };

    it('reorders task to specific valid index', () => {
      const res = PlannerEngine.reorderTasks([t1, t2, t3], 'T-1', 2);
      expect(res.map(t => t.key)).toEqual(['T-2', 'T-3', 'T-1']);
      expect(res[0].orderIndex).toBe(0);
      expect(res[1].orderIndex).toBe(1);
      expect(res[2].orderIndex).toBe(2);
    });

    it('clamps negative targetIndex to 0 and excessive targetIndex to end', () => {
      const resLow = PlannerEngine.reorderTasks([t1, t2, t3], 'T-3', -5);
      expect(resLow[0].key).toBe('T-3');

      const resHigh = PlannerEngine.reorderTasks([t1, t2, t3], 'T-1', 99);
      expect(resHigh[2].key).toBe('T-1');
    });

    it('returns unchanged list if task is not found', () => {
      const res = PlannerEngine.reorderTasks([t1, t2], 'UNKNOWN', 1);
      expect(res.map(t => t.key)).toEqual(['T-1', 'T-2']);
    });
  });

  describe('buildWbsHierarchy', () => {
    it('groups subtasks directly beneath parent tasks', () => {
      const parent: WbsTask = { ...sampleTask, key: 'P-1', id: 'p1' };
      const sub1: WbsTask = { ...sampleTask, key: 'S-1', id: 's1', parentKey: 'P-1' };
      const sub2: WbsTask = { ...sampleTask, key: 'S-2', id: 's2', parentId: 'p1' };
      const standalone: WbsTask = { ...sampleTask, key: 'T-2', id: 't2' };

      const res = PlannerEngine.buildWbsHierarchy([parent, sub1, standalone, sub2]);
      expect(res.map(t => t.key)).toEqual(['P-1', 'S-1', 'S-2', 'T-2']);
      expect(res[0].isSubtask).toBe(false);
      expect(res[1].isSubtask).toBe(true);
      expect(res[2].isSubtask).toBe(true);
      expect(res[3].isSubtask).toBe(false);
    });

    it('appends orphaned subtasks whose parents are not in the list', () => {
      const orphan: WbsTask = { ...sampleTask, key: 'ORPHAN-1', id: 'o1', parentKey: 'MISSING' };
      const res = PlannerEngine.buildWbsHierarchy([orphan]);
      expect(res.length).toBe(1);
      expect(res[0].key).toBe('ORPHAN-1');
      expect(res[0].isSubtask).toBe(true);
    });

    it('handles tasks without keys or matching by id only', () => {
      const parentNoKey: WbsTask = { ...sampleTask, key: '', id: 'pk-id' };
      const subNoKey: WbsTask = { ...sampleTask, key: '', id: 'sub-id', parentId: 'pk-id' };
      const orphanNoKey: WbsTask = { ...sampleTask, key: '', id: 'orphan-id', parentId: 'missing-parent' };

      const res = PlannerEngine.buildWbsHierarchy([parentNoKey, subNoKey, orphanNoKey]);
      expect(res.length).toBe(3);
    });

    it('builds 3-tier hierarchy (Epic -> Story -> Subtask) with memory rollups', () => {
      const epic: WbsTask = {
        ...sampleTask,
        key: 'EPIC-1',
        id: 'e1',
        summary: 'Checkout Epic',
        isEpic: true,
        hierarchyLevel: 1,
        story: 'Epic'
      };
      const story1: WbsTask = {
        ...sampleTask,
        key: 'STORY-1',
        id: 's1',
        summary: 'Payment Gateway',
        parentKey: 'EPIC-1',
        hierarchyLevel: 0,
        effortHours: 40,
        progress: 50,
        startDate: '2026-10-14',
        endDate: '2026-10-21'
      };
      const subtask1: WbsTask = {
        ...sampleTask,
        key: 'SUB-1',
        id: 'sub1',
        summary: 'Stripe webhook',
        parentKey: 'STORY-1',
        hierarchyLevel: -1,
        effortHours: 20,
        progress: 100,
        startDate: '2026-10-14',
        endDate: '2026-10-18'
      };
      const story2: WbsTask = {
        ...sampleTask,
        key: 'STORY-2',
        id: 's2',
        summary: 'Checkout UI',
        parentKey: 'EPIC-1',
        hierarchyLevel: 0,
        effortHours: 60,
        progress: 20,
        startDate: '2026-10-21',
        endDate: '2026-10-28'
      };

      const sampleWeeks: WeeklySprintColumn[] = [
        { weekKey: 'W1', sprintName: 'Sprint 1', startDate: '2026-10-14', endDate: '2026-10-21' },
        { weekKey: 'W2', sprintName: 'Sprint 2', startDate: '2026-10-21', endDate: '2026-10-28' }
      ];

      const res = PlannerEngine.buildWbsHierarchy([epic, story1, subtask1, story2], sampleWeeks);

      // Verify order: Epic -> Story 1 -> Sub 1 -> Story 2
      expect(res.map(t => t.key)).toEqual(['EPIC-1', 'STORY-1', 'SUB-1', 'STORY-2']);

      // Check level flags
      expect(res[0].isEpic).toBe(true);
      expect(res[0].isSubtask).toBe(false);
      expect(res[1].isSubtask).toBe(false);
      expect(res[1].hierarchyLevel).toBe(0);
      expect(res[2].isSubtask).toBe(true);
      expect(res[2].hierarchyLevel).toBe(-1);
      expect(res[3].isSubtask).toBe(false);

      // Check rollup calculations on Epic
      expect(res[0].isRollup).toBe(true);
      expect(res[0].childrenCount).toBe(2);
      expect(res[0].effortHours).toBe(100); // 40h + 60h
      expect(res[0].rollupStats?.totalHours).toBe(100);
      expect(res[0].startDate).toBe('2026-10-14');
      expect(res[0].endDate).toBe('2026-10-28');

      // Check project completion calculation does not double count rollups
      const completion = PlannerEngine.calculateProjectCompletion(res);
      expect(completion.actualCompletion).toBeGreaterThan(0);
    });

    it('returns empty array when passed empty or null tasks', () => {
      expect(PlannerEngine.buildWbsHierarchy([])).toEqual([]);
      expect(PlannerEngine.buildWbsHierarchy(null as any)).toEqual([]);
    });

    it('aggregates contributing resources on parent tasks from subtasks', () => {
      const parentTask: WbsTask = {
        ...sampleTask,
        key: 'PARENT-1',
        id: 'p1',
        resource: 'Alice',
        subtasks: [
          {
            id: 'sub-embed-1',
            summary: 'QA verification',
            estimateValue: 8,
            estimateUnit: 'HOURS',
            normalizedHours: 8,
            status: 'NOT_STARTED',
            assignee: 'Charlie'
          }
        ]
      };
      const childSubtask: WbsTask = {
        ...sampleTask,
        key: 'CHILD-SUB-1',
        id: 'cs1',
        parentKey: 'PARENT-1',
        resource: 'Bob'
      };

      const res = PlannerEngine.buildWbsHierarchy([parentTask, childSubtask]);
      const parent = res.find(t => t.key === 'PARENT-1');
      expect(parent).toBeDefined();
      expect(parent?.contributingResources).toContain('Alice');
      expect(parent?.contributingResources).toContain('Bob');
      expect(parent?.contributingResources).toContain('Charlie');
      expect(parent?.rollupStats?.contributingResources).toContain('Bob');
    });

    it('aggregates contributing resources for standalone tasks with embedded subtasks', () => {
      const standaloneWithSubtasks: WbsTask = {
        ...sampleTask,
        key: 'STANDALONE-1',
        id: 'st1',
        resource: 'Unassigned',
        subtasks: [
          {
            id: 'sub-st-1',
            summary: 'Sub 1',
            estimateValue: 4,
            estimateUnit: 'HOURS',
            normalizedHours: 4,
            status: 'NOT_STARTED',
            assignee: 'Dev1'
          }
        ]
      };
      const res = PlannerEngine.buildWbsHierarchy([standaloneWithSubtasks]);
      expect(res[0].contributingResources).toEqual(['Dev1']);
    });

    it('handles orphaned stories whose parent epic is missing from schedule', () => {
      const orphanStory: WbsTask = {
        ...sampleTask,
        key: 'STORY-ALONE',
        id: 'sa1',
        epicKey: 'MISSING-EPIC',
        parentKey: 'MISSING-EPIC',
        hierarchyLevel: 0
      };
      const res = PlannerEngine.buildWbsHierarchy([orphanStory]);
      expect(res.length).toBe(1);
      expect(res[0].isSubtask).toBe(false);
      expect(res[0].hierarchyLevel).toBe(0);
    });

    it('infers levels from isSubtask flag, story type Epic, and links stories via epicKey', () => {
      const epic: WbsTask = {
        ...sampleTask,
        key: 'EPIC-A',
        id: 'ea',
        story: 'Epic',
        epicKey: 'EPIC-A'
      };
      const storyViaEpicKey: WbsTask = {
        ...sampleTask,
        key: 'STORY-A',
        id: 'sa',
        epicKey: 'EPIC-A' // linked via epicKey without parentKey
      };
      const subtaskExplicit: WbsTask = {
        ...sampleTask,
        key: 'SUB-A',
        id: 'suba',
        isSubtask: true,
        parentKey: 'STORY-A'
      };

      const res = PlannerEngine.buildWbsHierarchy([epic, storyViaEpicKey, subtaskExplicit]);
      expect(res.map(t => t.key)).toEqual(['EPIC-A', 'STORY-A', 'SUB-A']);
      expect(res[0].isEpic).toBe(true);
      expect(res[1].isSubtask).toBe(false);
      expect(res[2].isSubtask).toBe(true);
    });

    it('recovers all tasks if circular parentage exists', () => {
      const t1: WbsTask = { ...sampleTask, key: 'CYCLE-1', parentKey: 'CYCLE-2' };
      const t2: WbsTask = { ...sampleTask, key: 'CYCLE-2', parentKey: 'CYCLE-1' };

      const res = PlannerEngine.buildWbsHierarchy([t1, t2]);
      expect(res.length).toBe(2);
      expect(res.map(t => t.key)).toContain('CYCLE-1');
      expect(res.map(t => t.key)).toContain('CYCLE-2');
    });

    it('preserves manual progress on parent when manualProgress is true and does not overwrite with child rollup', () => {
      const parent: WbsTask = {
        ...sampleTask,
        key: 'EPIC-MANUAL',
        id: 'em',
        progress: 80,
        manualProgress: true,
        effortHours: 100
      };
      const child: WbsTask = {
        ...sampleTask,
        key: 'STORY-MANUAL',
        id: 'sm',
        parentKey: 'EPIC-MANUAL',
        progress: 10,
        effortHours: 50
      };

      const res = PlannerEngine.buildWbsHierarchy([parent, child]);
      const resParent = res.find(t => t.key === 'EPIC-MANUAL');
      expect(resParent?.progress).toBe(80);
      expect(resParent?.manualProgress).toBe(true);
      expect(resParent?.rollupStats?.progressPct).toBe(10);
    });

    it('calculates child progress rollup when parent manualProgress is false', () => {
      const parent: WbsTask = {
        ...sampleTask,
        key: 'EPIC-AUTO',
        id: 'ea',
        progress: 0,
        manualProgress: false,
        effortHours: 100
      };
      const child: WbsTask = {
        ...sampleTask,
        key: 'STORY-AUTO',
        id: 'sa',
        parentKey: 'EPIC-AUTO',
        progress: 60,
        effortHours: 50
      };

      const res = PlannerEngine.buildWbsHierarchy([parent, child]);
      const resParent = res.find(t => t.key === 'EPIC-AUTO');
      expect(resParent?.progress).toBe(60);
      expect(resParent?.rollupStats?.progressPct).toBe(60);
    });
  });

  describe('Universal Data Models: toWorkEffort and fromWorkEffort (Silverston / OFBiz / Moqui)', () => {
    it('converts WbsTask to canonical WorkEffort entity for Task, Epic, and Subtask with status mapping', () => {
      const task: WbsTask = {
        ...sampleTask,
        key: 'WE-1',
        summary: 'Database Migration',
        status: 'COMPLETED',
        effortHours: 40,
        progress: 100,
        targetProgress: 100,
        manualProgress: true,
        orderIndex: 2
      };
      const we = toWorkEffort(task);
      expect(we.workEffortId).toBe('WE-1');
      expect(we.workEffortTypeId).toBe('TASK');
      expect(we.currentStatusId).toBe('WE_COMPLETE');
      expect(we.percentComplete).toBe(100);
      expect(we.manualProgress).toBe(true);

      const epicTask: WbsTask = {
        ...sampleTask,
        key: 'WE-EPIC',
        summary: 'Cloud Modernization',
        isEpic: true,
        status: 'IN_PROGRESS'
      };
      const weEpic = toWorkEffort(epicTask);
      expect(weEpic.workEffortTypeId).toBe('EPIC');
      expect(weEpic.currentStatusId).toBe('WE_IN_PROGRESS');

      const subTask: WbsTask = {
        ...sampleTask,
        key: 'WE-SUB',
        summary: 'Schema DDL',
        isSubtask: true,
        status: 'NOT_STARTED'
      };
      const weSub = toWorkEffort(subTask);
      expect(weSub.workEffortTypeId).toBe('ACTIVITY');
      expect(weSub.currentStatusId).toBe('WE_PLANNED');
    });

    it('converts canonical WorkEffort entity back to WbsTask with associations and party assignments', () => {
      const we: WorkEffort = {
        workEffortId: 'WE-20',
        workEffortTypeId: 'TASK',
        workEffortName: 'API Microservices',
        currentStatusId: 'WE_COMPLETE',
        estimatedStartDate: '2026-08-01',
        estimatedCompletionDate: '2026-08-20',
        estimatedHours: 80,
        percentComplete: 100,
        targetPercentComplete: 100,
        workEffortParentId: 'WE-EPIC'
      };

      const parties: WorkEffortPartyAssignment[] = [
        {
          workEffortId: 'WE-20',
          partyId: 'user-lead',
          displayName: 'Tech Lead',
          roleTypeId: 'PRIMARY_ASSIGNEE'
        },
        {
          workEffortId: 'WE-20',
          partyId: 'user-dev',
          displayName: 'Backend Dev',
          roleTypeId: 'CONTRIBUTOR'
        }
      ];

      const assocs: WorkEffortAssoc[] = [
        {
          workEffortIdFrom: 'WE-19',
          workEffortIdTo: 'WE-20',
          workEffortAssocTypeId: 'FRACTIONAL_MILESTONE',
          triggerPercent: 50,
          isTriggerSatisfied: true
        }
      ];

      const task = fromWorkEffort(we, assocs, parties);
      expect(task.key).toBe('WE-20');
      expect(task.status).toBe('COMPLETED');
      expect(task.resource).toBe('Tech Lead');
      expect(task.contributingResources).toEqual(['Backend Dev']);
      expect(task.parentKey).toBe('WE-EPIC');
      expect(task.dependency?.predecessorKey).toBe('WE-19');
      expect(task.dependency?.triggerPercent).toBe(50);
      expect(task.dependency?.isTriggerSatisfied).toBe(true);
    });

    it('handles default conversion when parties and assocs are omitted', () => {
      const we: WorkEffort = {
        workEffortId: 'WE-DEFAULT',
        workEffortTypeId: 'ACTIVITY',
        workEffortName: 'Standalone Unit',
        currentStatusId: 'WE_IN_PROGRESS',
        estimatedHours: 16,
        percentComplete: 25,
        targetPercentComplete: 50
      };
      const task = fromWorkEffort(we);
      expect(task.status).toBe('IN_PROGRESS');
      expect(task.isSubtask).toBe(true);
      expect(task.resource).toBe('Unassigned');
      expect(task.dependency).toBeUndefined();
    });

    it('covers all toWorkEffort and fromWorkEffort edge cases and branches', () => {
      // 1. toWorkEffort fallback branches
      const minimalTask: WbsTask = {
        id: 'TASK-FALLBACK',
        summary: 'Minimal Fallback Task',
        orderIndex: 5,
        status: 'BLOCKED' as any,
        hierarchyLevel: 1,
        parentId: 'PARENT-ID'
      } as any;

      const weEpic = toWorkEffort(minimalTask);
      expect(weEpic.workEffortId).toBe('TASK-FALLBACK');
      expect(weEpic.workEffortTypeId).toBe('EPIC');
      expect(weEpic.currentStatusId).toBe('WE_PLANNED');
      expect(weEpic.estimatedHours).toBe(0);
      expect(weEpic.percentComplete).toBe(0);
      expect(weEpic.targetPercentComplete).toBe(0);
      expect(weEpic.workEffortParentId).toBe('PARENT-ID');

      const subtaskActivity: WbsTask = {
        id: 'SUB-1',
        summary: 'Subactivity',
        orderIndex: 1,
        status: 'IN_PROGRESS',
        hierarchyLevel: -1
      } as any;
      const weSub = toWorkEffort(subtaskActivity);
      expect(weSub.workEffortTypeId).toBe('ACTIVITY');
      expect(weSub.currentStatusId).toBe('WE_IN_PROGRESS');

      // 2. fromWorkEffort fallback branches
      const weStandard: WorkEffort = {
        workEffortId: 'WE-TASK',
        workEffortTypeId: 'TASK',
        workEffortName: 'Standard Work Unit',
        currentStatusId: 'WE_PLANNED',
        estimatedHours: 0,
        percentComplete: 0,
        targetPercentComplete: 0
      };
      const assocNoTrigger: WorkEffortAssoc[] = [
        {
          workEffortIdFrom: 'WE-PRED',
          workEffortIdTo: 'WE-TASK',
          workEffortAssocTypeId: 'PRECEDENCE',
          isTriggerSatisfied: false
        }
      ];
      const onlyPrimaryParty: WorkEffortPartyAssignment[] = [
        {
          workEffortId: 'WE-TASK',
          partyId: 'user-p',
          displayName: 'Solo Assignee',
          roleTypeId: 'PRIMARY_ASSIGNEE'
        }
      ];

      const convertedStandard = fromWorkEffort(weStandard, assocNoTrigger, onlyPrimaryParty);
      expect(convertedStandard.status).toBe('NOT_STARTED');
      expect(convertedStandard.isEpic).toBe(false);
      expect(convertedStandard.isSubtask).toBe(false);
      expect(convertedStandard.hierarchyLevel).toBe(0);
      expect(convertedStandard.startDate).toBe('');
      expect(convertedStandard.endDate).toBe('');
      expect(convertedStandard.resource).toBe('Solo Assignee');
      expect(convertedStandard.contributingResources).toBeUndefined();
      expect(convertedStandard.dependency?.triggerPercent).toBe(30); // fallback to 30

      // Activity hierarchy level branch
      const weSubtaskEffort: WorkEffort = {
        workEffortId: 'WE-SUB',
        workEffortTypeId: 'ACTIVITY',
        workEffortName: 'Sub Work Unit',
        currentStatusId: 'WE_PLANNED',
        estimatedHours: 0,
        percentComplete: 0,
        targetPercentComplete: 0
      };
      const convertedSubtask = fromWorkEffort(weSubtaskEffort);
      expect(convertedSubtask.isSubtask).toBe(true);
      expect(convertedSubtask.hierarchyLevel).toBe(-1);
    });
  });

  describe('Edge cases in PlannerEngine helpers', () => {
    const localWeeks: WeeklySprintColumn[] = [
      { weekKey: 'W1', sprintName: 'Sprint 1', startDate: '2026-07-01', endDate: '2026-07-07' },
      { weekKey: 'W2', sprintName: 'Sprint 2', startDate: '2026-07-08', endDate: '2026-07-14' },
      { weekKey: 'W3', sprintName: 'Sprint 3', startDate: '2026-07-15', endDate: '2026-07-21' }
    ];

    it('covers buildWbsHierarchy with orphaned child tasks and cyclic parent relationships', () => {
      const rootTask: WbsTask = {
        id: 'ROOT',
        key: 'ROOT',
        summary: 'Root Task',
        orderIndex: 0
      } as any;

      const orphanTask: WbsTask = {
        id: 'ORPHAN',
        key: 'ORPHAN',
        parentKey: 'NON_EXISTENT_PARENT',
        summary: 'Orphaned Task',
        orderIndex: 1
      } as any;

      const result = PlannerEngine.buildWbsHierarchy([rootTask, orphanTask], localWeeks);
      expect(result.map(t => t.key)).toEqual(['ROOT', 'ORPHAN']);

      const cycleA: WbsTask = { id: 'CYCLE_A', key: 'CYCLE_A', parentKey: 'CYCLE_B', summary: 'Cycle A', orderIndex: 0 } as any;
      const cycleB: WbsTask = { id: 'CYCLE_B', key: 'CYCLE_B', parentKey: 'CYCLE_A', summary: 'Cycle B', orderIndex: 1 } as any;
      const resCycle = PlannerEngine.buildWbsHierarchy([cycleA, cycleB], localWeeks);
      expect(resCycle.length).toBe(2);
    });

  });
});

