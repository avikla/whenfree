#!/usr/bin/env node
// PostToolUse hook: after an edit to a Cloud Functions source file, run the
// functions/ test suite (npm test). Exit 2 feeds the failure output back to
// Claude so it fixes the break before moving on. Other edits are ignored.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Unparseable stdin must not be a silent pass: say so, then skip.
const input = (() => {
  try { return JSON.parse(readStdin() || '{}'); } catch (e) {
    console.error('test-functions: could not parse hook input (' + e.message + '); tests NOT run.');
    return null;
  }
})();
if (!input) process.exit(0);
const edited = (input.tool_input && (input.tool_input.file_path || input.tool_input.path)) || '';
if (!edited) process.exit(0);

// Only react to source files under functions/, never to node_modules.
const norm = edited.replace(/\\/g, '/');
const inFunctions = /(^|\/)functions\//.test(norm) && !/node_modules\//.test(norm);
const isSource = /\.(js|json)$/.test(norm);
if (!inFunctions || !isSource) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const fnDir = path.join(root, 'functions');
if (!fs.existsSync(path.join(fnDir, 'package.json'))) process.exit(0);

// shell: true is required on Windows, where npm is npm.cmd.
const run = spawnSync('npm', ['test', '--silent'], {
  cwd: fnDir,
  shell: true,
  encoding: 'utf8',
  timeout: 120000,
});

if (run.status === 0) {
  console.log('test-functions: functions/ tests passed.');
  process.exit(0);
}

const output = `${run.stdout || ''}${run.stderr || ''}${run.error ? String(run.error) : ''}`;
console.error('test-functions: functions/ tests FAILED after editing ' + path.basename(edited) + '. Fix before continuing.');
console.error(output.trim().split('\n').slice(-60).join('\n'));
process.exit(2);
