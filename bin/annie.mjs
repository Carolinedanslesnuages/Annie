#!/usr/bin/env node
/** Annie: a plain, factual summary of a pull request, for the person who reviews it. */
import { execFileSync } from 'node:child_process';
import { mergeBase, changedFiles, commitTitles, dependencyChanges } from '../src/changes.mjs';
import { buildSummary, toMarkdown, toText, toJson } from '../src/summary.mjs';

const HELP = `Annie · le résumé d'une PR, pour la personne qui la relit

Usage : annie [options]

  Compare la branche courante avec sa base et dit, sans enjoliver : ce qui change, les points
  d'attention (tests retirés ou désactivés, code sans test, consignes d'agent, workflows,
  dépendances, migrations, variables d'environnement…) et les questions à poser.

  --base <ref>   branche ou commit de départ (défaut : origin/main, sinon main)
  --head <ref>   branche à résumer (défaut : HEAD)
  --markdown     en Markdown (pour un commentaire de PR)
  --json         en JSON
  --aide         cette aide

Rien n'est envoyé : Annie lit seulement l'historique git du dossier courant.`;

const colors = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (colors ? `\x1b[${code}m${text}\x1b[0m` : text);

function parseOptions(args) {
  const options = { head: 'HEAD' };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (['aide', '--aide', '-h', '--help'].includes(argument)) options.help = true;
    else if (argument === '--base') options.base = args[++index];
    else if (argument === '--head') options.head = args[++index];
    else if (argument === '--markdown') options.markdown = true;
    else if (argument === '--json') options.json = true;
    else throw new Error(`Option inconnue : ${argument}. Tapez « annie --aide ».`);
  }
  return options;
}

function defaultBase(folder) {
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', candidate], { cwd: folder, stdio: 'ignore' });
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error('Pas de branche main ni master ici : indiquez la base avec --base.');
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) return console.log(HELP);
  const folder = process.cwd();
  const start = mergeBase(folder, options.base || defaultBase(folder), options.head);
  const files = dependencyChanges(folder, start, options.head, changedFiles(folder, start, options.head));
  const summary = buildSummary(files, commitTitles(folder, start, options.head));
  if (options.json) return console.log(JSON.stringify(toJson(summary), null, 2));
  if (options.markdown) return console.log(toMarkdown(summary));
  console.log(toText(summary, { highlight: paint('1;38;5;212'), muted: paint('2') }));
}

try {
  main();
} catch (error) {
  console.error(`annie : ${error.message}`);
  process.exit(1);
}
