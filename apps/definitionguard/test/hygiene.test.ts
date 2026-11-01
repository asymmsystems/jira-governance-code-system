/**
 * B-19: hygiene, dead code and test truthfulness.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { getTemplateForCategory, BUG_DEFINITION_OF_DONE, DEFAULT_DEFINITION_OF_DONE, STORY_DEFINITION_OF_DONE, TASK_DEFINITION_OF_DONE, IT_HELP_DEFINITION_OF_DONE, SERVICE_REQUEST_DEFINITION_OF_DONE } from '../src/domain/checklist-engine';

const APP = path.join(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));

describe('B-19 hygiene', () => {
  it('every source file carries the Asymm Systems copyright header and @author Fahim Farook', () => {
    const missing = walk(path.join(APP, 'src'))
      .filter(f => /\.tsx?$/.test(f))
      .filter(f => {
        const head = fs.readFileSync(f, 'utf8').slice(0, 600);
        return !head.includes('Copyright (c) 2026 Asymm Systems') || !head.includes('@author Fahim Farook');
      })
      .map(f => path.relative(APP, f));
    expect(missing).toEqual([]);
  });

  it('has no dead panel renderer, no test-mode branch, and no unused v1 validator or repository', () => {
    const index = fs.readFileSync(path.join(APP, 'src/index.ts'), 'utf8');
    expect(index).not.toContain('renderIssuePanel');
    for (const f of walk(path.join(APP, 'src'))) expect(fs.readFileSync(f, 'utf8')).not.toContain("NODE_ENV");
    expect(fs.existsSync(path.join(APP, 'src/validator/transition-validator.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(APP, 'src/storage/checklist-repository.ts'), 'utf8')).not.toContain('class ChecklistRepository');
  });

  it('does not depend on the unused @forge/storage package', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@forge/storage']).toBeUndefined();
  });

  it('bundles the panel icon as a resource, with no remote icon URL', () => {
    const manifest = fs.readFileSync(path.join(APP, 'manifest.yml'), 'utf8');
    expect(manifest).toContain('icon: resource:icons;check.svg');
    expect(manifest).not.toMatch(/icon: https?:/);
    expect(manifest).toMatch(/- key: icons\n\s+path: static\/icons/);
    const svg = fs.readFileSync(path.join(APP, 'static/icons/check.svg'), 'utf8');
    expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('sets a 90% branch threshold for each source file, not only globally', () => {
    const config = require(path.join(APP, 'jest.config.js'));
    expect(config.coverageThreshold['./src/**/*.ts']).toMatchObject({ branches: 90 });
  });
});

describe('B-19 issue-type matching on whole words (DG-16)', () => {
  it.each([
    ['Bug', BUG_DEFINITION_OF_DONE.id],
    ['Production incident', BUG_DEFINITION_OF_DONE.id],
    ['Debug task', DEFAULT_DEFINITION_OF_DONE.id],
    ['Story', STORY_DEFINITION_OF_DONE.id],
    ['Storybook setup', DEFAULT_DEFINITION_OF_DONE.id],
    ['Chore', TASK_DEFINITION_OF_DONE.id],
    ['IT Help', IT_HELP_DEFINITION_OF_DONE.id],
    ['Supportability review', DEFAULT_DEFINITION_OF_DONE.id],
    ['Service Request', SERVICE_REQUEST_DEFINITION_OF_DONE.id],
    ['service_request', SERVICE_REQUEST_DEFINITION_OF_DONE.id]
  ])('%s gets %s', (type, id) => {
    expect(getTemplateForCategory(type).id).toBe(id);
  });
});
