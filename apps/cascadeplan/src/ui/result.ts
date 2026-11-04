/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: decides whether a resolver result is a failure the user must see (B-07, INV-05).
 */

export interface ResultVerdict {
  failed: boolean;
  message?: string;
}

/**
 * A null or missing result, ok false, success false or a failed Jira sync is a failure.
 */
export function classifyResult(res: any): ResultVerdict {
  if (res === null || res === undefined) {
    return { failed: true, message: 'The planner could not reach Jira. Nothing was changed.' };
  }
  if (res.ok === false || res.success === false) {
    const text = res.message || (res.error && res.error !== 'validation' ? res.error : undefined);
    return { failed: true, message: text || 'The change failed.' };
  }
  if (res.jiraSync && res.jiraSync.ok === false) {
    return {
      failed: true,
      message: res.jiraSync.error
        ? `Saved in CascadePlan, but Jira rejected part of it: ${res.jiraSync.error}`
        : 'Saved in CascadePlan, but Jira rejected part of it.'
    };
  }
  return { failed: false };
}
