import { PlannerEngine } from '../../src/domain/planner-engine';
import { WbsTask, WeeklySprintColumn, TaskDependency } from '../../src/domain/models';

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

  describe('evaluateDependency', () => {
    const dep: TaskDependency = {
      predecessorId: 'PRED-1',
      predecessorKey: 'DEMO-10',
      triggerPercent: 30,
      isTriggerSatisfied: false
    };

    it('returns isSatisfied: false if predecessor task is not found', () => {
      const res = PlannerEngine.evaluateDependency(undefined, dep);
      expect(res.isSatisfied).toBe(false);
      expect(res.blockerMessage).toContain('not found');
    });

    it('returns isSatisfied: true when predecessor progress meets trigger threshold', () => {
      const pred: WbsTask = { ...sampleTask, progress: 30 };
      const res = PlannerEngine.evaluateDependency(pred, dep);
      expect(res.isSatisfied).toBe(true);
      expect(res.blockerMessage).toBeUndefined();
    });

    it('returns isSatisfied: false when predecessor progress is below trigger threshold', () => {
      const pred: WbsTask = { ...sampleTask, progress: 20 };
      const res = PlannerEngine.evaluateDependency(pred, dep);
      expect(res.isSatisfied).toBe(false);
      expect(res.blockerMessage).toContain('Blocked');
      expect(res.earliestStartDate).toBeDefined();
    });

    it('calculates planned timeline earliest start date when predecessor has 0% progress', () => {
      const pred: WbsTask = { ...sampleTask, progress: 0, startDate: '2026-08-01', endDate: '2026-08-21' };
      const res = PlannerEngine.evaluateDependency(pred, dep);
      expect(res.isSatisfied).toBe(false);
      expect(res.earliestStartReason).toContain('Planned timeline');
      expect(res.earliestStartDate).toBeDefined();
    });

    it('calculates observed velocity earliest start date when predecessor has progress > 0 but < threshold', () => {
      const pred: WbsTask = { ...sampleTask, progress: 15, startDate: '2026-08-01', endDate: '2026-08-30' };
      const res = PlannerEngine.evaluateDependency(pred, dep, undefined, new Date('2026-08-10'));
      expect(res.isSatisfied).toBe(false);
      expect(res.earliestStartReason).toContain('Observed velocity');
      expect(res.earliestStartDate).toBeDefined();
    });

    it('flags violation if successor has already started while predecessor is below threshold', () => {
      const pred: WbsTask = { ...sampleTask, progress: 10 };
      const successor: WbsTask = { ...sampleTask, key: 'DEMO-2', progress: 25, status: 'IN_PROGRESS' };
      const res = PlannerEngine.evaluateDependency(pred, dep, successor);
      expect(res.isViolated).toBe(true);
      expect(res.blockerMessage).toContain('has already started');
    });

    it('flags violation if successor is scheduled to start before earliest calculated start date', () => {
      const pred: WbsTask = { ...sampleTask, progress: 0, startDate: '2026-08-01', endDate: '2026-08-31' };
      const successor: WbsTask = { ...sampleTask, key: 'DEMO-2', progress: 0, status: 'NOT_STARTED', startDate: '2026-08-03' };
      const res = PlannerEngine.evaluateDependency(pred, dep, successor);
      expect(res.isViolated).toBe(true);
      expect(res.blockerMessage).toContain('before earliest possible start date');
    });

    it('does not flag violation if successor is scheduled comfortably after earliest start date', () => {
      const pred: WbsTask = { ...sampleTask, progress: 0, startDate: '2026-08-01', endDate: '2026-08-31' };
      const successor: WbsTask = { ...sampleTask, key: 'DEMO-2', progress: 0, status: 'NOT_STARTED', startDate: '2026-08-25' };
      const res = PlannerEngine.evaluateDependency(pred, dep, successor);
      expect(res.isViolated).toBe(false);
      expect(res.blockerMessage).toBeUndefined();
    });

    it('evaluates dependency when predecessor has no explicit endDate and no explicit startDate', () => {
      const pred: WbsTask = { ...sampleTask, progress: 10, startDate: undefined as any, endDate: undefined as any };
      const res = PlannerEngine.evaluateDependency(pred, dep);
      expect(res.isSatisfied).toBe(false);
      expect(res.earliestStartDate).toBeDefined();
    });

    it('uses default empty existingTasks parameter in validateDependency when omitted', () => {
      const res = PlannerEngine.validateDependency('DEMO-2', 'DEMO-1', 40);
      expect(res.valid).toBe(true);
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
});
