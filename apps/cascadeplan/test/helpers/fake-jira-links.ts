/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan test helper: the Jira state a planner write changes and the next read must see.
 * Issue links ("Blocks", ADR-006) and issue properties (cascadeplan.dates, cascadeplan.links,
 * ADR-008) are kept in memory. A test's fake requestJira calls handle() first, and decorates every
 * issue its search returns with decorate().
 */

export class FakeJiraLinks {
  links: Array<{ id: string; pred: string; succ: string }> = [];
  props: Record<string, Record<string, unknown>> = {};
  private nextId = 9000;

  constructor(private readonly idOf: (key: string) => string = key => key.split('-')[1]) {}

  /** Answers link and property calls; undefined for any other call. */
  handle(url: string, opts?: any): any | undefined {
    const method = (opts && opts.method) || 'GET';
    const ok = (status: number, body: unknown = {}) => ({ status, json: async () => body });
    if (url === '/rest/api/3/issueLink' && method === 'POST') {
      const body = JSON.parse(opts.body);
      this.links.push({ id: String(this.nextId++), pred: body.inwardIssue.key, succ: body.outwardIssue.key });
      return ok(201);
    }
    const del = url.match(/^\/rest\/api\/3\/issueLink\/(\d+)$/);
    if (del && method === 'DELETE') {
      this.links = this.links.filter(l => l.id !== del[1]);
      return ok(204);
    }
    const prop = url.match(/^\/rest\/api\/3\/issue\/([A-Z][A-Z0-9_]+-\d+)\/properties\/([^/?]+)$/);
    if (prop) {
      const [, key, name] = prop;
      if (method === 'PUT') { this.props[key] = { ...(this.props[key] || {}), [name]: JSON.parse(opts.body) }; return ok(200); }
      if (method === 'DELETE') { const p = { ...(this.props[key] || {}) }; delete p[name]; this.props[key] = p; return ok(204); }
      const v = this.props[key]?.[name];
      return v === undefined ? ok(404, { errorMessages: ['not found'] }) : ok(200, { key: name, value: v });
    }
    const linkQuery = url.match(/^\/rest\/api\/3\/issue\/([A-Z][A-Z0-9_]+-\d+)\?fields=issuelinks$/);
    if (linkQuery) return ok(200, { fields: { issuelinks: this.issuelinksFor(linkQuery[1]) } });
    return undefined;
  }

  /** The "Blocks" links on a successor, as Jira shows them. */
  issuelinksFor(key: string): any[] {
    return this.links.filter(l => l.succ === key)
      .map(l => ({ id: l.id, type: { name: 'Blocks' }, inwardIssue: { key: l.pred, id: this.idOf(l.pred) } }));
  }

  /** A search issue with its links and properties added. */
  decorate(issue: any): any {
    if (!issue || !issue.key) return issue;
    return { ...issue,
      fields: { ...(issue.fields || {}), issuelinks: [...((issue.fields && issue.fields.issuelinks) || []), ...this.issuelinksFor(issue.key)] },
      properties: { ...(issue.properties || {}), ...(this.props[issue.key] || {}) } };
  }
}
