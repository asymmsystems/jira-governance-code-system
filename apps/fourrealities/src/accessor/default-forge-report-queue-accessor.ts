/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the report job queue (Forge async events, queue fourrealities-report-jobs). An event
 * holds only the report id; the job record in KVS holds the rest.
 */

import { Queue } from '@forge/events';
import { ReportQueueAccessor } from '../contract/reports';

export const REPORT_QUEUE = 'fourrealities-report-jobs';

export interface QueueClient {
  push(event: { body: { reportId: string }; delayInSeconds?: number }): Promise<unknown>;
}

export class DefaultForgeReportQueueAccessor implements ReportQueueAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly queue: QueueClient = new Queue({ key: REPORT_QUEUE })) {}

  async push(reportId: string, delaySeconds?: number): Promise<void> {
    await this.queue.push({ body: { reportId }, ...(delaySeconds ? { delayInSeconds: Math.min(900, Math.max(1, Math.round(delaySeconds))) } : {}) });
  }
}
