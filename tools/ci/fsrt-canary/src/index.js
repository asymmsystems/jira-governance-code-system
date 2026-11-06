/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */
// FSRT canary: the resolver reads an issue as the app and never checks that the caller may see it.
// FSRT must report this as Custom-Check-Authorization. Do not fix it.
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('readIssue', async (req) => {
  const issueKey = req.payload.issueKey;
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`);
  return response.json();
});

export const handler = resolver.getDefinitions();
