/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Writes to Jira as the user: creates that are safe to repeat, fields, links, link percents and properties.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import api, { route } from '@forge/api';
import { WbsTask } from '../domain/models';
import { describeJiraChanges } from '../domain/jira-change';
import { PlanStore, StoredEntry } from '../storage/plan-store';
import { sha256Hex } from '../domain/sha256';
import { logFailure } from '../logger';
import { ValidationError } from '../validation';
import { DATES_PROPERTY, LINKS_PROPERTY, SyncLog, getJiraCaller, isIsoDate, stripJiraOwnedFields } from './core';
import { LiveData, findBlocksLinkId } from './jira-read';

/**
 * Creates a new Jira issue and places it on the schedule or backlog.
 */
/**
 * C7: a create is safe to repeat. The client sends a create id with a create; the new issue keeps it
 * in the issue property `cascadeplan.create` (indexed by the jira:entityProperty module), set in the
 * same create request. When a call ended without an answer and the user repeats it, the client sends
 * the same id, and an issue that the first call created is found and returned instead of a second one.
 */
export const CREATE_PROPERTY = 'cascadeplan.create';
export const CREATE_ID = /^[A-Za-z0-9-]{8,60}$/;

/** The create id of a payload, or undefined when there is none. */
export function createIdOf(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !CREATE_ID.test(value)) throw new ValidationError('createId', 'createId must be 8 to 60 letters, digits or hyphens');
  return value;
}

/** The issue of the project that a call with this create id already created, or undefined. */
export async function findCreatedIssue(projectKey: string, createId: string): Promise<{ id: string; key: string } | undefined> {
  const jql = `project = "${projectKey}" AND issue.property[${CREATE_PROPERTY}].id = "${createId}"`;
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=1`);
    if (!res || res.status !== 200) return undefined;
    const found = ((await res.json()).issues || [])[0];
    return found && found.id && found.key ? { id: String(found.id), key: String(found.key) } : undefined;
  } catch (err) {
    logFailure('findCreatedIssue', err);
    return undefined;
  }
}

/**
 * POST /rest/api/3/issue as the user. With a create id, an issue an earlier call created with it is
 * returned as if Jira had just created it (status 201, `reused: true`), and a new issue carries the id.
 */
export async function postIssueOnce(projectKey: string, body: any, createId?: string): Promise<any> {
  if (createId) {
    const found = await findCreatedIssue(projectKey, createId);
    if (found) return { status: 201, reused: true, json: async () => found };
    body = { ...body, properties: [...(body.properties || []), { key: CREATE_PROPERTY, value: { id: createId, v: 1 } }] };
  }
  return getJiraCaller().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/**
 * The create id of one of several issues one call creates, from a value that names that issue in
 * every repeat of the call (an account id, a stored sub-task id), never from its position: a repeat
 * after a partial success has fewer items to create.
 */
export function partCreateId(createId: string | undefined, part: string): string | undefined {
  return createId ? `${createId}-${sha256Hex(part).slice(0, 12)}` : undefined;
}

/**
 * Synchronizes task edits back to Jira Cloud (two-way sync).
 */
export async function syncTaskToJira(
  taskIdOrKey: string,
  updates: Partial<WbsTask>,
  log?: SyncLog,
  before: Partial<WbsTask> = {},
  options: { propertyEnd?: string } = {}
): Promise<{ synced: boolean; error?: string; fields: string[] }> {
  const result = await syncTaskFields(taskIdOrKey, updates, options.propertyEnd);
  if (log) {
    // Each write is logged with its old and new values; a field Jira refused is logged as not written (B-23).
    // A start date written unchanged (moving the task onto the shared property, ADR-008) is not listed.
    const shown = result.fields.filter(f => !(f === 'startdate' && typeof updates.startDate === 'string' && before.startDate === updates.startDate));
    log.record(taskIdOrKey, shown, result, describeJiraChanges(shown, before, updates));
    // Each refused field is reported with its own reason (F-08).
    for (const field of result.rejected) {
      log.record(taskIdOrKey, [field], { synced: false, error: result.reasons[field] || 'Jira did not accept the change' },
        describeJiraChanges([field], before, updates));
    }
  }
  return result;
}

export async function syncTaskFields(
  taskIdOrKey: string,
  updates: Partial<WbsTask>,
  propertyEnd?: string
): Promise<{ synced: boolean; error?: string; fields: string[]; rejected: string[]; reasons: Record<string, string> }> {
  const fields: Record<string, any> = {};
  let dropped: string[] = [];
  const reasons: Record<string, string> = {};
  let statusReason: string | undefined;

  if (updates.summary && typeof updates.summary === 'string' && updates.summary.trim()) {
    fields.summary = updates.summary.trim();
  }

  if (updates.endDate && typeof updates.endDate === 'string') {
    fields.duedate = updates.endDate.slice(0, 10);
  }

  if (typeof updates.effortHours === 'number' && updates.effortHours > 0) {
    fields.timetracking = {
      originalEstimate: `${updates.effortHours}h`
    };
  }

  if (updates.epicKey !== undefined) {
    // The epic link is the Jira parent; an empty key removes it.
    fields.parent = updates.epicKey ? { key: updates.epicKey } : null;
  }

  if (updates.resourceAccountId) {
    if (updates.resourceAccountId === 'unassigned') {
      fields.assignee = null;
    } else if (!updates.resourceAccountId.startsWith('ph:')) {
      fields.assignee = {
        accountId: updates.resourceAccountId
      };
    }
  }

  const caller = getJiraCaller();
  let syncSuccess = true;
  let errMsg: string | undefined;

  // Update Jira issue fields if any
  if (Object.keys(fields).length > 0) {
    try {
      let res = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });

      if (!res || res.status < 200 || res.status >= 300) {
        // Graceful retry without duedate if duedate is rejected by screen layout
        if (res?.status === 400 && fields.duedate) {
          try {
            const errJson = await res.json();
            if (errJson?.errors?.duedate) {
              const fallbackFields = { ...fields };
              delete fallbackFields.duedate;
              if (Object.keys(fallbackFields).length > 0) {
                const retryRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fields: fallbackFields })
                });
                res = retryRes;
                dropped = ['duedate'];
              }
            }
          } catch (err) { logFailure('syncTaskFields', err); }
        }

        // Dedicated assignee fallback if resourceAccountId is set
        let assigneeRecovered = false;
        if (updates.resourceAccountId) {
          try {
            const assBody = {
              accountId: (updates.resourceAccountId === 'unassigned' || updates.resourceAccountId.startsWith('ph:'))
                ? null
                : updates.resourceAccountId
            };
            const assRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/assignee`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assBody)
            });
            if (assRes?.status >= 200 && assRes?.status < 300) {
              assigneeRecovered = true;
            }
          } catch (err) { logFailure('syncTaskFields', err); }
        }

        if (res && res.status >= 200 && res.status < 300) {
          syncSuccess = true;
        } else if (assigneeRecovered && Object.keys(fields).length === 1 && fields.assignee !== undefined) {
          syncSuccess = true;
        } else {
          syncSuccess = false;
          try {
            const errJson = await res.json();
            if (errJson.errorMessages && errJson.errorMessages.length > 0) {
              errMsg = errJson.errorMessages.join(', ');
            } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
              errMsg = Object.values(errJson.errors).join(', ');
            } else {
              errMsg = JSON.stringify(errJson);
            }
          } catch {
            errMsg = `Jira status ${res?.status || 500}`;
          }
        }
      }
    } catch (err: any) {
      return { synced: false, error: err?.message || 'Network error updating Jira issue', fields: Object.keys(fields), rejected: [], reasons };
    }
  }

  // After a successful retry without the due date, the due date was not written.
  const rejected = syncSuccess ? [...dropped] : [];
  if (rejected.includes('duedate')) reasons.duedate = 'Jira did not accept the due date on this issue screen';
  const sentFields = Object.keys(fields).filter(f => !rejected.includes(f));
  // ADR-008: the shared start is the issue property, written after Jira accepted the due date (or when
  // the end did not change). It needs the start; an update with only an end leaves the property alone.
  if (typeof updates.startDate === 'string' && syncSuccess && !rejected.includes('duedate')) {
    const end = typeof updates.endDate === 'string' ? updates.endDate : propertyEnd;
    const value = { startDate: updates.startDate.slice(0, 10), ...(isIsoDate(end) ? { endDate: end.slice(0, 10) } : {}), v: 1 };
    let ok = false;
    try {
      const res = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/properties/${DATES_PROPERTY}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
      });
      ok = !!res && (res.status === 200 || res.status === 201 || res.status === 204);
      if (!ok) logFailure('startDateProperty', res);
    } catch (err) { logFailure('startDateProperty', err); }
    if (ok) sentFields.push('startdate');
    else { rejected.push('startdate'); reasons.startdate = 'Jira did not save the start date'; }
  }
  // Status workflow transition sync
  if (updates.status) {
    // The status counts as written only when Jira applied a transition (F-08).
    statusReason = 'Jira could not read the workflow transitions of this issue';
    try {
      const transRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/transitions`);
      if (transRes.status === 200) {
        const transData = await transRes.json();
        const targetStatus = updates.status;
        const match = (transData.transitions || []).find((tr: any) => {
          const cat = tr.to?.statusCategory?.key?.toLowerCase();
          const nm = tr.name?.toLowerCase() || '';
          if (targetStatus === 'COMPLETED' && (cat === 'done' || nm.includes('done') || nm.includes('resolve') || nm.includes('close'))) return true;
          if (targetStatus === 'IN_PROGRESS' && (cat === 'indeterminate' || nm.includes('progress'))) return true;
          if (targetStatus === 'NOT_STARTED' && (cat === 'new' || cat === 'undefined' || nm.includes('to do') || nm.includes('open') || nm.includes('reopen'))) return true;
          return false;
        });
        if (match) {
          const postRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/transitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transition: { id: match.id } })
          });
          statusReason = postRes && postRes.status === 204 ? undefined : `Jira did not apply the "${match.name || match.id}" transition`;
        } else {
          statusReason = `No workflow transition leads to ${String(targetStatus).replace('_', ' ').toLowerCase()} from the current status`;
        }
      }
    } catch (err) { logFailure('syncTaskFields', err); }
  }

  if (updates.status) {
    if (statusReason) {
      rejected.push('status');
      reasons.status = statusReason;
    } else {
      sentFields.push('status');
    }
  }
  return { synced: syncSuccess, error: errMsg, fields: sentFields, rejected, reasons };
}

/**
 * Mirrors a dependency into a native Jira "Blocks" link. Reuses an existing link, so saving the
 * same dependency twice creates one link, and returns the link id.
 */
/**
 * Sets and removes trigger percents on the successor's issue property cascadeplan.links, as the user
 * (ADR-006). Returns the saved value, or null when Jira did not save it.
 */
export async function updateLinkPercents(successorKey: string, set: Record<string, number>, remove: string[]): Promise<{ v: number; links: Record<string, number> } | null> {
  const caller = getJiraCaller();
  try {
    const cur = await caller.requestJira(route`/rest/api/3/issue/${successorKey}/properties/${LINKS_PROPERTY}`);
    let links: Record<string, number> = {};
    if (cur && cur.status === 200) {
      const body = await cur.json();
      if (body?.value?.links && typeof body.value.links === 'object') links = { ...body.value.links };
    } else if (!cur || cur.status !== 404) {
      logFailure('updateLinkPercents', cur);
      return null;
    }
    for (const id of remove) delete links[id];
    Object.assign(links, set);
    const value = { v: 1, links };
    const res = await caller.requestJira(route`/rest/api/3/issue/${successorKey}/properties/${LINKS_PROPERTY}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
    });
    if (!res || ![200, 201, 204].includes(res.status)) { logFailure('updateLinkPercents', res); return null; }
    return value;
  } catch (err) {
    logFailure('updateLinkPercents', err);
    return null;
  }
}

/** Records a link this call created or deleted in the Jira data it already holds (as applyAcceptedDueDate does). */
export function patchLiveLinks(live: LiveData, successorKey: string, add: { key: string; linkId?: string } | undefined, removeLinkIds: string[]): void {
  const pred = add ? (live.raw.issues || []).find((i: any) => i && i.key === add.key) : undefined;
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) => {
    if (!i || i.key !== successorKey) return i;
    let links = (Array.isArray(i.fields?.issuelinks) ? i.fields.issuelinks : []).filter((l: any) => !removeLinkIds.includes(String(l.id)));
    if (add && !links.some((l: any) => l.inwardIssue?.key === add.key && ['blocks', 'dependency'].includes(String(l.type?.name || '').toLowerCase()))) {
      links = [...links, { ...(add.linkId ? { id: add.linkId } : {}), type: { name: 'Blocks' }, inwardIssue: { key: add.key, id: pred ? String(pred.id) : add.key } }];
    }
    return { ...i, fields: { ...(i.fields || {}), issuelinks: links } };
  }) };
}

export function patchLiveProperty(live: LiveData, issueKey: string, property: string, value: unknown): void {
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) =>
    (!i || i.key !== issueKey ? i : { ...i, properties: { ...(i.properties || {}), [property]: value } })) };
}

export async function mirrorDependencyToJira(
  successorKey: string,
  predecessorKey: string
): Promise<{ linked: boolean; linkId?: string; created?: boolean; error?: string }> {
  try {
    const existing = await findBlocksLinkId(successorKey, predecessorKey);
    if (existing) return { linked: true, linkId: existing, created: false };
    const body = {
      type: { name: 'Blocks' },
      inwardIssue: { key: predecessorKey },
      outwardIssue: { key: successorKey }
    };
    const caller = getJiraCaller();
    const res = await caller.requestJira(route`/rest/api/3/issueLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res?.status !== 201) return { linked: false };
    return { linked: true, linkId: await findBlocksLinkId(successorKey, predecessorKey), created: true };
  } catch (err: any) {
    return { linked: false, error: err?.message };
  }
}

/**
 * Deletes a Jira issue link by id. Used only for links that CascadePlan created.
 */
export async function removeMirroredLink(linkId: string): Promise<boolean> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issueLink/${linkId}`, { method: 'DELETE' });
    return res?.status === 204 || res?.status === 200;
  } catch {
    return false;
  }
}

/**
 * Records a due date that Jira accepted in the Jira data this call already holds, so the plan built
 * afterwards (the response, or the next item of a batch) shows the written end, not the end read
 * before the write (F-03). A due date Jira refused is left as Jira holds it.
 */
export function applyAcceptedDueDate(
  live: LiveData, issueKey: string, updates: Partial<WbsTask>, result: { synced: boolean; fields: string[] }
): void {
  if (!result.synced) return;
  const due = result.fields.includes('duedate') && typeof updates.endDate === 'string' ? updates.endDate.slice(0, 10) : undefined;
  // The start property this call wrote (ADR-008) is recorded the same way.
  const prop = result.fields.includes('startdate') && typeof updates.startDate === 'string'
    ? { startDate: updates.startDate.slice(0, 10), ...(typeof updates.endDate === 'string' ? { endDate: updates.endDate.slice(0, 10) } : {}), v: 1 }
    : undefined;
  if (!due && !prop) return;
  // A new list on this call's own data: the issue objects themselves are never changed.
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) => {
    if (!i || i.key !== issueKey) return i;
    return { ...i,
      fields: due ? { ...(i.fields || {}), duedate: due } : i.fields,
      properties: prop ? { ...(i.properties || {}), [DATES_PROPERTY]: prop } : i.properties };
  }) };
}

/**
 * The Jira writes of one task update, run after its record is saved (F-07). A dependency exists only
 * as a Jira link (ADR-004): when Jira refuses the link, the record is put back and nothing else is
 * written. The link id and new sub-task keys Jira returns are stored with a second versioned write.
 */
export async function applyPlannedJiraWrites(
  store: PlanStore, projectKey: string, target: WbsTask, savedEntry: StoredEntry, previous: StoredEntry | undefined,
  plan: { link?: { predecessorKey: string }; removeLinkIds: string[]; newSubtasks: Array<{ accountId: string; summary: string }>;
    subtaskAction?: { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' }; percents: Record<string, number>; removePercentIds: string[] },
  log: SyncLog,
  live?: LiveData,
  createId?: string
): Promise<{ ok: true; entry: StoredEntry } | { ok: false; result: any }> {
  let entry: any = { ...savedEntry };
  let changed = false;
  if (plan.link) {
    const mirror = await mirrorDependencyToJira(target.key, plan.link.predecessorKey);
    log.record(target.key, ['issuelink'], { synced: mirror.linked, error: mirror.error || 'Jira did not create the link' });
    if (!mirror.linked) {
      const { issueKey: _k, issueId: _i, version: _v, ...prior } = (previous || {}) as any;
      await store.putEntry(target.key, target.id, stripJiraOwnedFields(prior), savedEntry.version);
      return { ok: false, result: { ok: false, success: false, error: 'link_refused', jiraSync: log.report(),
        message: `Jira did not create the link from ${plan.link.predecessorKey} to ${target.key}, so the dependency was not added and nothing was changed.` } };
    }
    if (live) patchLiveLinks(live, target.key, { key: plan.link.predecessorKey, linkId: mirror.linkId }, []);
  }
  // Any Jira link the user removes is deleted, whoever created it (N-11 L3).
  const removedLinkIds: string[] = [];
  for (const linkId of plan.removeLinkIds) {
    const ok = await removeMirroredLink(linkId);
    if (ok) removedLinkIds.push(linkId);
    log.record(target.key, ['issuelink'], { synced: ok, error: 'Jira did not delete the link' });
  }
  if (live && removedLinkIds.length) patchLiveLinks(live, target.key, undefined, removedLinkIds);
  // The trigger percents are the successor's issue property (ADR-006, N-11 L4).
  if (Object.keys(plan.percents).length || plan.removePercentIds.length) {
    const saved = await updateLinkPercents(target.key, plan.percents, plan.removePercentIds);
    log.record(target.key, ['linkpercent'], { synced: !!saved, error: 'Jira did not save the trigger percent' });
    if (live && saved) patchLiveProperty(live, target.key, LINKS_PROPERTY, saved);
  }
  if (plan.newSubtasks.length) {
    for (const s of plan.newSubtasks) {
      let subtaskKey: string | undefined;
      for (const stType of ['Sub-task', 'Subtask']) {
        try {
          const subRes = await postIssueOnce(projectKey, { fields: { project: { key: projectKey }, parent: { key: target.key }, summary: s.summary,
            issuetype: { name: stType }, assignee: { accountId: s.accountId } } }, partCreateId(createId, s.accountId));
          if (subRes && subRes.status === 201) {
            subtaskKey = String((await subRes.json()).key);
            log.record(subtaskKey, ['create'], { synced: true });
            break;
          }
        } catch (err) { logFailure('applyPlannedJiraWrites', err); }
      }
      // A person is a contributor only through a real Jira sub-task (ADR-004).
      entry.contributors = (entry.contributors || []).flatMap((c: any) =>
        (c.accountId === s.accountId && !c.subtaskKey ? (subtaskKey ? [{ ...c, subtaskKey }] : []) : [c]));
      if (!subtaskKey) log.record(target.key, ['contributor'], { synced: false, error: 'Jira did not create the sub-task, so the person was not added' });
      changed = true;
    }
  }
  if (plan.subtaskAction && plan.subtaskAction.action !== 'keep') {
    const { subtaskKey, action } = plan.subtaskAction;
    const caller = getJiraCaller();
    if (action === 'delete') {
      const delRes = await caller.requestJira(route`/rest/api/3/issue/${subtaskKey}`, { method: 'DELETE' });
      const ok = !!delRes && (delRes.status === 204 || delRes.status === 200);
      log.record(subtaskKey, ['delete'], { synced: ok, error: ok ? undefined : 'Jira did not delete the subtask' });
    } else if (action === 'unassign') {
      const unassignRes = await caller.requestJira(route`/rest/api/3/issue/${subtaskKey}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { assignee: null } })
      });
      const ok = !!unassignRes && (unassignRes.status === 200 || unassignRes.status === 204);
      log.record(subtaskKey, ['unassign'], { synced: ok, error: ok ? undefined : 'Jira did not unassign the subtask' });
    }
  }
  if (changed) {
    const { issueKey: _k, issueId: _i, version, ...rest } = entry;
    const put = await store.putEntry(target.key, target.id, stripJiraOwnedFields(rest), version);
    if (put.ok) entry = put.entry;
  }
  return { ok: true, entry };
}
