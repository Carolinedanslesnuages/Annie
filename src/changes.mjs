/**
 * What a branch changes compared with its base, read from git: files (status, lines added and
 * removed, added and removed text) and commit titles. Nothing is sent anywhere.
 */
import { execFileSync } from 'node:child_process';

const runGit = (args, folder) => execFileSync('git', args, { cwd: folder, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/** The commit the branch started from (merge base), so changes made on the base meanwhile are left out. */
export function mergeBase(folder, base, head = 'HEAD') {
  try {
    return runGit(['merge-base', base, head], folder).trim();
  } catch {
    throw new Error(`Impossible de comparer avec « ${base} » : cette branche ou ce commit n'existe pas ici.`);
  }
}

const STATUSES = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied', T: 'modified' };

/** Files changed: [{ path, previousPath, status, additions, deletions, addedLines, removedLines, binary }]. */
export function changedFiles(folder, start, head = 'HEAD') {
  const files = new Map();
  const statusFields = runGit(['diff', '-z', '--name-status', '-M', start, head], folder).split('\0').filter(Boolean);
  for (let index = 0; index < statusFields.length;) {
    const code = statusFields[index++];
    const renamed = code.startsWith('R') || code.startsWith('C');
    const previousPath = renamed ? statusFields[index++] : null;
    const path = statusFields[index++];
    files.set(path, { path, previousPath, status: STATUSES[code[0]] || 'modified', additions: 0, deletions: 0, addedLines: [], removedLines: [], binary: false });
  }
  // With -z, a renamed file reads "added<TAB>removed<TAB>" then the old and new paths.
  const numstat = runGit(['diff', '-z', '--numstat', '-M', start, head], folder).split('\0');
  for (let index = 0; index < numstat.length - 1;) {
    const [added, removed, inlinePath] = numstat[index++].split('\t');
    let path = inlinePath;
    if (!path) {
      index++; // previous path
      path = numstat[index++];
    }
    const file = files.get(path);
    if (!file) continue;
    file.binary = added === '-';
    file.additions = file.binary ? 0 : Number(added);
    file.deletions = file.binary ? 0 : Number(removed);
  }
  // "--- a/path" then "+++ b/path" open each file; "+++ /dev/null" means the file was deleted.
  let current = null;
  let previousHeaderPath = null;
  for (const line of runGit(['diff', '-U0', '--no-color', '-M', start, head], folder).split('\n')) {
    if (line.startsWith('--- ')) {
      previousHeaderPath = line.startsWith('--- a/') ? line.slice(6) : null;
      continue;
    }
    if (line.startsWith('+++ ')) {
      current = line.startsWith('+++ b/') ? files.get(line.slice(6)) || null : files.get(previousHeaderPath) || null;
      continue;
    }
    if (!current || line.startsWith('@@')) continue;
    if (line.startsWith('+')) current.addedLines.push(line.slice(1));
    else if (line.startsWith('-')) current.removedLines.push(line.slice(1));
  }
  return [...files.values()];
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function manifestAt(folder, revision, path) {
  try {
    return JSON.parse(runGit(['show', `${revision}:${path}`], folder));
  } catch {
    return {}; // missing on this side, or not valid JSON
  }
}

/** For each package.json: the dependencies added, changed (new version) and removed. */
export function dependencyChanges(folder, start, head, files) {
  for (const file of files.filter((candidate) => /(^|\/)package\.json$/.test(candidate.path))) {
    const before = manifestAt(folder, start, file.previousPath || file.path);
    const after = file.status === 'deleted' ? {} : manifestAt(folder, head, file.path);
    const versions = (manifest) => Object.assign({}, ...DEPENDENCY_FIELDS.map((field) => manifest[field] || {}));
    const [old, current] = [versions(before), versions(after)];
    file.dependencies = {
      added: Object.keys(current).filter((name) => !(name in old)),
      changed: Object.keys(current).filter((name) => name in old && old[name] !== current[name]),
      removed: Object.keys(old).filter((name) => !(name in current)),
    };
  }
  return files;
}

/** Commit titles of the branch, oldest first (merge commits, like the one GitHub tests a PR on, left out). */
export function commitTitles(folder, start, head = 'HEAD') {
  return runGit(['log', '--reverse', '--no-merges', '--format=%s', `${start}..${head}`], folder).split('\n').filter(Boolean);
}
