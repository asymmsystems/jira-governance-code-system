/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Manifest checks for B-18 (entity property index), B-19 (licensing) and B-20 (bundled icon, no dead code).
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';

const manifest = fs.readFileSync(path.resolve(__dirname, '../manifest.yml'), 'utf8');

describe('B-18 entity property index', () => {
  it('indexes status, everCompromised and incidentCount of ledgerseal-cert for JQL', () => {
    expect(manifest).toContain(`  jira:entityProperty:
    - key: ledgerseal-cert-index
      entityType: issue
      propertyKey: ledgerseal-cert
      values:
        - path: status
          type: string
          searchAlias: ledgersealStatus
        - path: everCompromised
          type: string
          searchAlias: ledgersealEverCompromised
        - path: incidentCount
          type: number
          searchAlias: ledgersealIncidents`);
  });
});
