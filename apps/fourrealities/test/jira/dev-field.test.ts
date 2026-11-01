/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Development field parser unit tests
 */

import { parseDevField } from '../../src/accessor/dev-field';

const withJson = (pr: any) =>
  `{pullrequest={dataType=pullrequest, state=${pr.state}, stateCount=${pr.count}}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":${pr.count},"state":"${pr.state}","details":{"openCount":${pr.open},"mergedCount":${pr.merged},"declinedCount":${pr.declined},"total":${pr.count}},"open":${pr.open > 0}},"byInstanceType":{}}}},"isStale":false}}`;

describe('parseDevField', () => {
  it('reads the JSON summary when present', () => {
    expect(parseDevField(withJson({ state: 'MERGED', count: 2, open: 0, merged: 2, declined: 0 })))
      .toEqual({ count: 2, state: 'MERGED', openCount: 0, mergedCount: 2, declinedCount: 0 });
    expect(parseDevField(withJson({ state: 'OPEN', count: 1, open: 1, merged: 0, declined: 0 })).state).toBe('OPEN');
  });

  it('falls back to the pullrequest summary when the JSON is absent or broken', () => {
    expect(parseDevField('{pullrequest={dataType=pullrequest, state=DECLINED, stateCount=1}}'))
      .toEqual({ count: 1, state: 'DECLINED', openCount: 0, mergedCount: 0, declinedCount: 1 });
    expect(parseDevField('{pullrequest={dataType=pullrequest, state=OPEN, stateCount=3}, json={broken'))
      .toEqual({ count: 3, state: 'OPEN', openCount: 3, mergedCount: 0, declinedCount: 0 });
  });

  it('reports no pull request for empty, missing or non-PR values', () => {
    const none = { count: 0, state: null, openCount: 0, mergedCount: 0, declinedCount: 0 };
    expect(parseDevField(undefined)).toEqual(none);
    expect(parseDevField('{}')).toEqual(none);
    expect(parseDevField('{repository={count=1}}')).toEqual(none);
    expect(parseDevField('{pullrequest={dataType=pullrequest, state=SOMETHING, stateCount=1}}').state).toBeNull();
  });
});
