/**
 * Source rule for log lines (security questionnaire question 8), the same file in every app's test/support/.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * A console call may not be given an error's message (`.message`), its stack (`.stack`), `String(...)` of
 * anything, or a caught error itself (the variable of a `catch`, or a usual error name such as `err`). The
 * one way to say something about an error is `errorSummary(<error>)`, which keeps only its name, code and
 * HTTP status, or a `logFailure` helper that calls it. Any other use of `console` (an alias, a bracket call)
 * is refused too, so a log call cannot escape the rule.
 */

/** Names that are taken to hold an error in any file, besides the variables of its catch clauses. */
export const ERROR_NAMES = ['err', 'error', 'e', 'ex', 'exc', 'exception', 'reason', 'cause', 'failure'];

const METHOD = /^console\s*\.\s*(log|info|warn|error|debug|trace)\s*\(/;

/** The text with every comment replaced by spaces (line breaks kept), so a comment is never read as code. */
export function withoutComments(text: string): string {
  let out = '';
  let i = 0;
  const templates: number[] = [];
  let quote: string | null = null;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (quote === '`' && c === '$' && n === '{') { out += n; templates.push(0); quote = null; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && n === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (templates.length && c === '{') templates[templates.length - 1]++;
    else if (templates.length && c === '}') {
      if (templates[templates.length - 1] === 0) { templates.pop(); quote = '`'; }
      else templates[templates.length - 1]--;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * From `open` (the index of a call's "("), the argument text up to the matching ")", and the code of it:
 * the same text with the contents of string literals and of template text blanked, and the expressions
 * inside `${...}` kept.
 */
function argumentsAt(code: string, open: number): { text: string; expr: string } {
  let depth = 0;
  let expr = '';
  const templates: number[] = [];
  let quote: string | null = null;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') { expr += '  '; i++; continue; }
      if (quote === '`' && c === '$' && code[i + 1] === '{') { expr += '  '; templates.push(0); quote = null; i++; continue; }
      if (c === quote) { quote = null; expr += c; continue; }
      expr += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; expr += c; continue; }
    if (templates.length && c === '{') templates[templates.length - 1]++;
    if (templates.length && c === '}') {
      if (templates[templates.length - 1] === 0) { templates.pop(); quote = '`'; expr += ' '; continue; }
      templates[templates.length - 1]--;
    }
    if (c === '(') depth++;
    if (c === ')') {
      depth--;
      if (depth === 0) return { text: code.slice(open + 1, i), expr: expr.slice(1) };
    }
    expr += c;
  }
  return { text: code.slice(open + 1), expr: expr.slice(1) };
}

/** The variable names bound by the catch clauses and `.catch(...)` callbacks of the file. */
export function caughtNames(code: string): string[] {
  const names = new Set<string>();
  for (const m of code.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\.catch\s*\(\s*(?:async\s+)?(?:function\s*)?\(?\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return [...names];
}

/** What is wrong with the console calls of one source file: one text per fault, with its line number. */
export function consoleViolations(source: string): string[] {
  const code = withoutComments(source);
  const lineOf = (index: number) => code.slice(0, index).split('\n').length;
  const errorNames = new Set([...ERROR_NAMES, ...caughtNames(code)]);
  const faults: string[] = [];
  for (const m of code.matchAll(/(?<![\w$.])console\b/g)) {
    const at = m.index ?? 0;
    const call = METHOD.exec(code.slice(at));
    if (!call) {
      faults.push(`line ${lineOf(at)}: console is used other than as console.<method>(...)`);
      continue;
    }
    const { expr } = argumentsAt(code, at + call[0].length - 1);
    const where = `line ${lineOf(at)}: console.${call[1]}`;
    if (/\.\s*message\b/.test(expr)) faults.push(`${where} is given an error's message`);
    if (/\.\s*stack\b/.test(expr)) faults.push(`${where} is given an error's stack`);
    if (/(?<![\w$.])String\s*\(/.test(expr)) faults.push(`${where} is given String(...)`);
    const rest = expr.replace(/(?<![\w$.])errorSummary\s*\(\s*[A-Za-z_$][\w$]*\s*\)/g, ' ');
    for (const id of rest.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)/g)) {
      if (errorNames.has(id[1])) faults.push(`${where} is given the error ${id[1]}`);
    }
  }
  return faults;
}
