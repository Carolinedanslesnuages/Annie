/**
 * Points d'attention: facts a reviewer should look at, each with the question to ask.
 * A signal: { rule, message, files, question }. Rule ids are public (--json): they stay in French.
 */
import { categoryOf } from './categories.mjs';

const DISABLED_TEST = /\b(it|test|describe|context)\.(skip|only|todo)\b|\b(xit|xdescribe|xtest|fit|fdescribe)\s*\(|@Disabled\b|@pytest\.mark\.skip|\{\s*skip\s*:\s*true|t\.skip\(/;
const ASSERTION = /\b(assert|expect)\b|\.should\b/;
const ENV_READ = /process\.env\.([A-Z_][A-Z0-9_]*)|process\.env\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]|import\.meta\.env\.([A-Z_][A-Z0-9_]*)|os\.environ(?:\.get)?\s*[[(]\s*['"]([A-Z_][A-Z0-9_]*)['"]/g;
const TODO = /\b(TODO|FIXME|HACK|XXX)\b/;
const PERMISSIONS_LINE = /^\s*(permissions\s*:|contents\s*:\s*write|pull-requests\s*:\s*write|id-token\s*:\s*write|actions\s*:\s*write)/;
const LARGE_FILE_LINES = 400;

const paths = (files) => files.map((file) => file.path);
const list = (items, limit = 4) => (items.length > limit ? `${items.slice(0, limit).join(', ')} et ${items.length - limit} autre(s)` : items.join(', '));

export function signalsOf(files) {
  const signals = [];
  const report = (rule, message, matched, question) => signals.push({ rule, message, files: paths(matched), question });
  const byCategory = (category) => files.filter((file) => categoryOf(file.path) === category);

  const deletedTests = byCategory('test').filter((file) => file.status === 'deleted');
  if (deletedTests.length) report('tests-supprimes', `${deletedTests.length} fichier(s) de test supprimé(s) : ${list(paths(deletedTests))}.`, deletedTests, 'Pourquoi ces tests ont-ils été supprimés, et qu’est-ce qui vérifie maintenant ce qu’ils vérifiaient ?');

  const disabled = files.filter((file) => file.addedLines.some((line) => DISABLED_TEST.test(line)));
  if (disabled.length) report('tests-desactives', `Des tests sont désactivés ou isolés (skip, only, todo…) dans ${list(paths(disabled))}.`, disabled, 'Ces tests désactivés sont-ils voulus ? Un « only » oublié fait ignorer tous les autres tests.');

  const weakened = byCategory('test').filter((file) => file.status !== 'deleted' && file.removedLines.filter((line) => ASSERTION.test(line)).length > file.addedLines.filter((line) => ASSERTION.test(line)).length);
  if (weakened.length) report('verifications-retirees', `Des vérifications (assert, expect) sont retirées de ${list(paths(weakened))}.`, weakened, 'Pourquoi ces vérifications ont-elles disparu ?');

  const code = byCategory('code').filter((file) => file.status !== 'deleted');
  if (code.length && !byCategory('test').length) report('code-sans-test', `Le code change (${code.length} fichier(s)) sans qu’aucun test ne change.`, code, 'Comment ce changement est-il vérifié ?');

  const agent = byCategory('agent');
  if (agent.length) report('consignes-agent', `Les consignes d’agent changent : ${list(paths(agent))}.`, agent, 'Ces consignes changent ce que font les agents dans ce dépôt : la modification est-elle voulue et relue ?');

  const ciFiles = byCategory('ci');
  const permissions = ciFiles.filter((file) => file.addedLines.some((line) => PERMISSIONS_LINE.test(line)));
  if (permissions.length) report('droits-ci', `Les droits d’un workflow changent dans ${list(paths(permissions))}.`, permissions, 'Ce workflow a-t-il vraiment besoin de ces droits en écriture ?');
  else if (ciFiles.length) report('ci-modifiee', `L’intégration continue change : ${list(paths(ciFiles))}.`, ciFiles, 'Les contrôles qui protègent la branche principale tournent-ils toujours ?');

  const manifests = files.filter((file) => file.dependencies);
  const named = (changeKind) => manifests.flatMap((file) => file.dependencies[changeKind]);
  const [addedDependencies, changedDependencies, removedDependencies] = ['added', 'changed', 'removed'].map(named);
  if (addedDependencies.length || changedDependencies.length || removedDependencies.length) {
    const parts = [
      addedDependencies.length && `ajoutée(s) : ${list(addedDependencies, 6)}`,
      changedDependencies.length && `nouvelle version : ${list(changedDependencies, 6)}`,
      removedDependencies.length && `retirée(s) : ${list(removedDependencies, 6)}`,
    ].filter(Boolean);
    const touched = manifests.filter((file) => Object.values(file.dependencies).some((names) => names.length));
    report('dependances', `Dépendances ${parts.join(' ; ')}.`, touched, 'Chaque nouvelle dépendance est-elle nécessaire, ancienne d’au moins deux semaines et sous une licence compatible ? (Madeleine le vérifie.)');
  } else {
    // A release only changes the project's own "version" lines: not a dependency change.
    const versionOnly = (file) => [...file.addedLines, ...file.removedLines].every((line) => /^\s*"version"\s*:/.test(line));
    const lockfiles = byCategory('dependencies').filter((file) => !/package\.json$/.test(file.path) && !versionOnly(file));
    if (lockfiles.length) report('verrou-dependances', `Le fichier de verrouillage des dépendances change sans qu’aucune dépendance déclarée ne change : ${list(paths(lockfiles))}.`, lockfiles, 'D’où vient ce changement du fichier de verrouillage (mise à jour voulue, autre version de npm) ?');
  }

  const migrations = byCategory('migration');
  if (migrations.length) report('migrations', `Une migration de base de données change : ${list(paths(migrations))}.`, migrations, 'La migration peut-elle être annulée, et a-t-elle été essayée sur une copie des données ?');

  const envVariables = new Set();
  const envFiles = files.filter((file) => {
    let found = false;
    for (const line of file.addedLines) for (const match of line.matchAll(ENV_READ)) {
      envVariables.add(match[1] || match[2] || match[3] || match[4]);
      found = true;
    }
    return found;
  });
  if (envVariables.size) report('variables-env', `Nouvelle(s) variable(s) d’environnement lue(s) : ${list([...envVariables].sort(), 6)}.`, envFiles, 'Ces variables sont-elles documentées (README ou .env.example) et configurées là où le projet tourne ?');

  const deleted = files.filter((file) => file.status === 'deleted' && categoryOf(file.path) !== 'test');
  if (deleted.length) report('fichiers-supprimes', `${deleted.length} fichier(s) supprimé(s) : ${list(paths(deleted))}.`, deleted, 'Plus rien n’utilise ces fichiers ?');

  const todos = files.filter((file) => file.addedLines.some((line) => TODO.test(line)));
  if (todos.length) report('a-faire', `Des TODO ou FIXME sont ajoutés dans ${list(paths(todos))}.`, todos, 'Ce qui reste à faire est-il noté ailleurs (ticket, PR suivante) ?');

  const large = files.filter((file) => file.additions >= LARGE_FILE_LINES);
  if (large.length) report('gros-ajouts', `Plus de ${LARGE_FILE_LINES} lignes ajoutées d’un coup dans ${list(paths(large))}.`, large, 'Ce fichier pourrait-il être découpé, ou relu en plusieurs fois ?');

  return signals;
}
