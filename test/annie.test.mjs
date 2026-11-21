import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryOf } from '../src/categories.mjs';

const BINARY = fileURLToPath(new URL('../bin/annie.mjs', import.meta.url));

/** A throwaway repository: `base` files on main, then `change` (path → content, or null to delete) on a branch. */
function repositoryWith(base, change, message = 'feat: changement') {
  const folder = mkdtempSync(join(tmpdir(), 'annie-'));
  const runGit = (...args) => execFileSync('git', args, { cwd: folder, stdio: 'ignore' });
  const write = (files) => {
    for (const [path, content] of Object.entries(files)) {
      if (content === null) rmSync(join(folder, path));
      else {
        mkdirSync(dirname(join(folder, path)), { recursive: true });
        writeFileSync(join(folder, path), content);
      }
    }
  };
  runGit('init', '-q', '-b', 'main');
  runGit('config', 'user.email', 'essai@exemple.fr');
  runGit('config', 'user.name', 'essai');
  write({ 'README.md': '# Projet\n', ...base });
  runGit('add', '-A');
  runGit('commit', '-q', '-m', 'base');
  runGit('switch', '-q', '-c', 'branche');
  write(change);
  runGit('add', '-A');
  runGit('commit', '-q', '-m', message);
  return folder;
}

const runCli = (folder, ...args) => spawnSync(process.execPath, [BINARY, '--base', 'main', ...args], { cwd: folder, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const rulesOf = (folder) => JSON.parse(runCli(folder, '--json').stdout).points.map((point) => point.regle);

test('genres de fichiers', () => {
  const expected = {
    'AGENTS.md': 'agent', '.claude/skills/x/SKILL.md': 'agent', '.github/workflows/ci.yml': 'ci', 'package.json': 'dependencies',
    'src/db/migrations/001.ts': 'migration', 'src/user.spec.ts': 'test', 'test/run.mjs': 'test', 'README.md': 'docs',
    '.env.example': 'config', 'tsconfig.json': 'config', 'src/App.vue': 'code',
  };
  for (const [path, category] of Object.entries(expected)) assert.equal(categoryOf(path), category, path);
});

test('une PR propre : chiffres, genres, commits, rien à signaler', () => {
  const folder = repositoryWith({ 'src/a.js': 'export const value = 1;\n', 'test/a.test.js': 'assert(value);\n' }, { 'src/a.js': 'export const value = 2;\n', 'test/a.test.js': 'assert(value);\nassert(value === 2);\n' }, 'fix: 🐞 corriger a');
  const output = runCli(folder).stdout;
  assert.match(output, /2 fichiers · \+2 −1 · 1 commit/);
  assert.match(output, /code +1 +\+1 −1/);
  assert.match(output, /· fix: 🐞 corriger a/);
  assert.match(output, /Rien de particulier dans le diff/);
  assert.deepEqual(rulesOf(folder), []);
});

test('tests supprimés, désactivés, vérifications retirées, code sans test', () => {
  assert.deepEqual(rulesOf(repositoryWith({ 'src/a.js': 'a\n', 'test/a.test.js': 't\n' }, { 'test/a.test.js': null })), ['tests-supprimes']);
  assert.deepEqual(rulesOf(repositoryWith({ 'test/a.test.js': "test('x', () => {});\n" }, { 'test/a.test.js': "test.only('x', () => {});\n" })), ['tests-desactives']);
  assert.deepEqual(rulesOf(repositoryWith({ 'test/a.test.js': 'expect(a).toBe(1);\nexpect(b).toBe(2);\n' }, { 'test/a.test.js': 'expect(a).toBe(1);\n' })), ['verifications-retirees']);
  assert.deepEqual(rulesOf(repositoryWith({ 'src/a.js': 'a\n' }, { 'src/a.js': 'b\n' })), ['code-sans-test']);
});

test('consignes d’agent, droits de workflow, migrations, variables, suppressions, TODO, gros ajouts', () => {
  assert.deepEqual(rulesOf(repositoryWith({}, { 'AGENTS.md': '# Consignes\n' })), ['consignes-agent']);
  assert.deepEqual(rulesOf(repositoryWith({ '.github/workflows/ci.yml': 'on: push\n' }, { '.github/workflows/ci.yml': 'on: push\npermissions:\n  contents: write\n' })), ['droits-ci']);
  assert.deepEqual(rulesOf(repositoryWith({ '.github/workflows/ci.yml': 'on: push\n' }, { '.github/workflows/ci.yml': 'on: [push, pull_request]\n' })), ['ci-modifiee']);
  assert.deepEqual(rulesOf(repositoryWith({}, { 'src/db/migrations/002.sql': 'ALTER TABLE x;\n' })), ['migrations']);
  const envPoints = JSON.parse(runCli(repositoryWith({ 'test/a.test.js': 't\n' }, { 'src/config.js': "const databaseUrl = process.env.DATABASE_URL;\nconst apiKey = import.meta.env.VITE_KEY;\n", 'test/a.test.js': 't2\n' }), '--json').stdout).points;
  assert.equal(envPoints[0].regle, 'variables-env');
  assert.match(envPoints[0].message, /DATABASE_URL, VITE_KEY/);
  assert.deepEqual(rulesOf(repositoryWith({ 'docs/old.md': 'x\n' }, { 'docs/old.md': null })), ['fichiers-supprimes']);
  assert.deepEqual(rulesOf(repositoryWith({ 'docs/a.md': 'x\n' }, { 'docs/a.md': 'x\nTODO : finir\n' })), ['a-faire']);
  assert.deepEqual(rulesOf(repositoryWith({}, { 'docs/long.md': 'ligne\n'.repeat(450) })), ['gros-ajouts']);
});

test('dépendances : ajoutées, nouvelle version, retirées ; une simple version du projet ne compte pas', () => {
  const manifest = (extra) => JSON.stringify({ name: 'projet', version: '1.0.0', dependencies: { vue: '3.5.0', axios: '1.0.0' }, ...extra }, null, 2);
  const changed = repositoryWith({ 'package.json': manifest() }, { 'package.json': JSON.stringify({ name: 'projet', version: '1.0.0', dependencies: { vue: '3.5.44', pinia: '2.0.0' } }, null, 2) });
  const point = JSON.parse(runCli(changed, '--json').stdout).points.find((entry) => entry.regle === 'dependances');
  assert.match(point.message, /ajoutée\(s\) : pinia ; nouvelle version : vue ; retirée\(s\) : axios/);
  const release = repositoryWith({ 'package.json': manifest(), 'package-lock.json': '{\n  "version": "1.0.0"\n}\n' }, { 'package.json': manifest({ version: '1.1.0' }), 'package-lock.json': '{\n  "version": "1.1.0"\n}\n' });
  assert.deepEqual(rulesOf(release), [], 'une version publiée par release-please ne déclenche rien');
  const lockOnly = repositoryWith({ 'package-lock.json': '{\n  "lodash": "4.17.20"\n}\n' }, { 'package-lock.json': '{\n  "lodash": "4.17.21"\n}\n' });
  assert.deepEqual(rulesOf(lockOnly), ['verrou-dependances']);
});

test('Markdown pour un commentaire de PR, avec le marqueur qui permet de le mettre à jour', () => {
  const folder = repositoryWith({ 'src/a.js': 'a\n' }, { 'src/a.js': 'b\n', 'AGENTS.md': '# x\n' });
  const markdown = runCli(folder, '--markdown').stdout;
  assert.match(markdown, /^<!-- annie:resume -->\n## Résumé pour la relecture/);
  assert.match(markdown, /\| code \| 1 \| \+1 −1 \|/);
  assert.match(markdown, /### Points d’attention\n\n- Le code change[\s\S]*- Les consignes d’agent changent : AGENTS\.md\./);
  assert.match(markdown, /### Questions à poser\n\n1\. Comment ce changement est-il vérifié \?/);
  assert.match(markdown, /<sub>Annie constate, sans juger/);
});

test('base inconnue, option inconnue, aide', () => {
  const folder = repositoryWith({}, { 'docs/a.md': 'a\n' });
  const unknownBase = spawnSync(process.execPath, [BINARY, '--base', 'nulle-part'], { cwd: folder, encoding: 'utf8' });
  assert.equal(unknownBase.status, 1);
  assert.equal(unknownBase.stderr.trim(), 'annie : Impossible de comparer avec « nulle-part » : cette branche ou ce commit n\'existe pas ici.');
  assert.match(spawnSync(process.execPath, [BINARY, '--nimporte'], { cwd: folder, encoding: 'utf8' }).stderr, /Option inconnue/);
  assert.match(spawnSync(process.execPath, [BINARY, '--aide'], { encoding: 'utf8' }).stdout, /le résumé d'une PR/);
});
