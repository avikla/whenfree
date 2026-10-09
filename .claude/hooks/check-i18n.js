#!/usr/bin/env node
// PostToolUse hook: after any edit to index.html, verify every language in
// LANGS (en/he/fr) has exactly the same keys. Exit 2 feeds the report back
// to Claude so it fixes the gap before moving on.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

const input = (() => { try { return JSON.parse(readStdin() || '{}'); } catch { return {}; } })();
const edited = (input.tool_input && (input.tool_input.file_path || input.tool_input.path)) || '';
if (edited && path.basename(edited) !== 'index.html') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const file = edited && path.isAbsolute(edited) ? edited : path.join(root, 'index.html');
if (!fs.existsSync(file)) process.exit(0);

const src = fs.readFileSync(file, 'utf8');
const start = src.indexOf('const LANGS = {');
if (start === -1) {
  console.error('check-i18n: could not find "const LANGS = {" in index.html. If LANGS was renamed, update .claude/hooks/check-i18n.js.');
  process.exit(2);
}
const end = src.indexOf('\n};', start);
if (end === -1) {
  console.error('check-i18n: could not find the closing "};" of LANGS.');
  process.exit(2);
}
const code = src.slice(start, end + 3).replace('const LANGS =', 'LANGS =');

// LANGS values reference icon constants (_AR, _X, ...). Stub any missing
// identifier as an empty string and retry.
const ctx = vm.createContext({});
let langs = null;
for (let i = 0; i < 100 && !langs; i++) {
  try {
    vm.runInContext(code, ctx, { timeout: 1000 });
    langs = ctx.LANGS;
  } catch (e) {
    const m = e && typeof e.message === "string" && /^(\w+) is not defined/.exec(e.message);
    if (!m) {
      console.error(`check-i18n: LANGS failed to parse: ${e.message}`);
      process.exit(2);
    }
    ctx[m[1]] = '';
  }
}
if (!langs) { console.error('check-i18n: could not evaluate LANGS.'); process.exit(2); }

const codes = Object.keys(langs);
const all = new Set(codes.flatMap(c => Object.keys(langs[c])));
const problems = [];
for (const c of codes) {
  const missing = [...all].filter(k => !(k in langs[c]));
  if (missing.length) problems.push(`  ${c} is missing ${missing.length}: ${missing.join(', ')}`);
}
if (problems.length) {
  console.error(`check-i18n: LANGS keys are out of sync across ${codes.join('/')}:\n${problems.join('\n')}\nAdd the missing translations before continuing.`);
  process.exit(2);
}
process.exit(0);
