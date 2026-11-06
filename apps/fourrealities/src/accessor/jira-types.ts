/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the parts of Jira REST responses that the Accessors read. Every field is
 * optional because Jira omits fields the caller cannot see; parsers check each value.
 */

export interface JiraStatusJson {
  id?: string;
  name?: string;
  statusCategory?: { key?: string; name?: string };
}

export interface JiraChangelogJson {
  /** Status changes carry status ids in from and to. The names (fromString, toString) are not read. */
  histories?: Array<{ items?: Array<{ field?: string; from?: string | null; to?: string | null }> | null }>;
}

export interface JiraIssueLinkJson {
  type?: { inward?: string; outward?: string };
  inwardIssue?: JiraLinkedIssueJson;
  outwardIssue?: JiraLinkedIssueJson;
}

export interface JiraLinkedIssueJson {
  key?: string;
  fields?: { summary?: string; issuetype?: { name?: string } };
}

export interface JiraIssueFieldsJson {
  summary?: string;
  status?: JiraStatusJson;
  assignee?: { displayName?: string; accountId?: string } | null;
  updated?: string;
  issuelinks?: JiraIssueLinkJson[];
  project?: { key?: string };
  sprint?: { name?: string } | null;
  customfield_10020?: Array<{ name?: string }> | null;
  /** The Development field and other custom fields, read by id. */
  [fieldId: string]: unknown;
}

export interface JiraIssueJson {
  id?: string | number;
  key?: string;
  fields?: JiraIssueFieldsJson;
  properties?: Record<string, unknown>;
  changelog?: JiraChangelogJson;
}

export interface JiraRemoteLinkJson {
  url?: string;
  title?: string;
  globalId?: string;
  object?: { url?: string; title?: string };
  application?: { type?: string };
}

export interface JiraFieldJson {
  id?: string;
  name?: string;
  schema?: { custom?: string };
}

export interface JiraSearchPageJson {
  issues?: JiraIssueJson[];
  nextPageToken?: string;
  isLast?: boolean;
}

/** The request body and method the Accessors send. */
export interface JiraRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
