/**
 * v1 checklist hash. Kept because the v1 record format (dg:checklist) carries it and the migration records it.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as crypto from 'crypto';
import { ChecklistAuditEvent, ChecklistItemInstance } from './models';

function codeUnitCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Calculates a deterministic SHA-256 hash of the checklist state.
 * Binds items, monotonic state version, and audit trail to ensure non-monotonic integrity.
 */
export function calculateChecklistHash(
  items: ChecklistItemInstance[],
  stateVersion: number = 1,
  auditTrail: ChecklistAuditEvent[] = []
): string {
  const sortedItems = [...items].sort((a, b) => codeUnitCompare(a.id, b.id));
  
  const serializedItems = sortedItems.map(item => ({
    id: item.id,
    title: item.title,
    isMandatory: item.isMandatory,
    isCompleted: item.isCompleted,
    category: item.category,
    completedBy: item.completedBy || null,
    completedByAccountId: item.completedByAccountId || null,
    completedAt: item.completedAt || null,
    notes: item.notes || null
  }));

  const payload = {
    stateVersion,
    items: serializedItems,
    eventCount: auditTrail.length,
    lastEventId: auditTrail.length > 0 ? auditTrail[auditTrail.length - 1].id : null
  };

  const jsonString = JSON.stringify(payload);
  return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
}
