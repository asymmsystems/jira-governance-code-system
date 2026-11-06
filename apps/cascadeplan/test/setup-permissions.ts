/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Tests that do not exercise permissions run with a checker that grants everything. The module is
 * loaded inside beforeEach, so it is the same instance (with the test file's @forge/api mock) that
 * src/index uses. test/write-permissions.test.ts restores the real Jira check.
 */
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const permissions = require('../src/security/write-permissions');
  permissions.setPermissionCheckerForTests(permissions.allowAllPermissions);
});
