/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-12: the untyped planner must not call a name that is defined nowhere. esbuild bundles such a
 * call without a warning, and it throws ReferenceError only when the user reaches that path.
 * TypeScript reports it as TS2304 ("Cannot find name") or TS2552 ("Did you mean").
 */
import * as path from 'path';
import * as ts from 'typescript';

const FILE = path.join(__dirname, '..', 'src', 'frontend', 'legacy-planner.js');

describe('F-12: names in the legacy planner', () => {
  it('every name the planner uses is defined or imported', () => {
    const program = ts.createProgram([FILE], {
      allowJs: true,
      checkJs: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts']
    });
    const source = program.getSourceFile(FILE)!;
    const undefinedNames = ts.getPreEmitDiagnostics(program, source)
      .filter(d => d.code === 2304 || d.code === 2552)
      .map(d => {
        const { line } = source.getLineAndCharacterOfPosition(d.start || 0);
        return `${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
      });
    expect(undefinedNames).toEqual([]);
  }, 60000);
});
