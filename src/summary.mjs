/**
 * The summary for the reviewer: size, kinds of files, commit titles, points of attention and
 * questions. Written like Annie Ernaux wrote: plain facts, no judgement.
 */
import { categoryOf, categoryLabel, CATEGORIES } from './categories.mjs';
import { signalsOf } from './signals.mjs';

/** Marker of Annie's comment on a pull request, so the same comment is updated. */
export const COMMENT_MARKER = '<!-- annie:resume -->';

const plural = (count, word, pluralWord = `${word}s`) => `${count} ${count > 1 ? pluralWord : word}`;
const lineCounts = (additions, deletions) => `+${additions} −${deletions}`;

export function buildSummary(files, commits) {
  const byCategory = CATEGORIES.map(([id]) => {
    const matched = files.filter((file) => categoryOf(file.path) === id);
    return { id, label: categoryLabel(id), count: matched.length, additions: matched.reduce((total, file) => total + file.additions, 0), deletions: matched.reduce((total, file) => total + file.deletions, 0) };
  }).filter((category) => category.count);
  const signals = signalsOf(files);
  return {
    fileCount: files.length,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0),
    commits,
    byCategory,
    signals,
    questions: [...new Set(signals.map((signal) => signal.question))],
  };
}

const NOTE = 'Annie constate, sans juger : ces points sont tirés du diff, pas un avis sur la qualité. Ce qu’elle ne voit pas (la logique, la pertinence) reste à relire.';

export function toMarkdown(summary) {
  const lines = [COMMENT_MARKER, '## Résumé pour la relecture', ''];
  if (!summary.fileCount) return [...lines, 'Aucun fichier ne change.'].join('\n');
  lines.push(`**${plural(summary.fileCount, 'fichier')} · ${lineCounts(summary.additions, summary.deletions)}** · ${plural(summary.commits.length, 'commit')}`, '');
  lines.push('| Genre | Fichiers | Lignes |', '|---|---|---|');
  for (const category of summary.byCategory) lines.push(`| ${category.label} | ${category.count} | ${lineCounts(category.additions, category.deletions)} |`);
  if (summary.commits.length) lines.push('', '### Ce que disent les commits', '', ...summary.commits.slice(0, 20).map((title) => `- ${title}`));
  if (summary.commits.length > 20) lines.push(`- … et ${summary.commits.length - 20} autre(s)`);
  lines.push('', '### Points d’attention', '');
  if (summary.signals.length) lines.push(...summary.signals.map((signal) => `- ${signal.message}`));
  else lines.push('Rien de particulier dans le diff : ni test retiré, ni dépendance, ni consigne d’agent, ni workflow.');
  if (summary.questions.length) lines.push('', '### Questions à poser', '', ...summary.questions.map((question, index) => `${index + 1}. ${question}`));
  lines.push('', `<sub>${NOTE}</sub>`);
  return lines.join('\n');
}

export function toText(summary, { highlight = (text) => text, muted = (text) => text } = {}) {
  if (!summary.fileCount) return 'Aucun fichier ne change.';
  const lines = [highlight('Résumé pour la relecture'), `${plural(summary.fileCount, 'fichier')} · ${lineCounts(summary.additions, summary.deletions)} · ${plural(summary.commits.length, 'commit')}`, ''];
  const width = Math.max(...summary.byCategory.map((category) => category.label.length));
  for (const category of summary.byCategory) lines.push(`  ${category.label.padEnd(width)}  ${String(category.count).padStart(3)}  ${muted(lineCounts(category.additions, category.deletions))}`);
  if (summary.commits.length) lines.push('', highlight('Ce que disent les commits'), ...summary.commits.slice(0, 20).map((title) => `  · ${title}`));
  lines.push('', highlight('Points d’attention'));
  if (summary.signals.length) lines.push(...summary.signals.map((signal) => `  ! ${signal.message}`));
  else lines.push('  Rien de particulier dans le diff.');
  if (summary.questions.length) lines.push('', highlight('Questions à poser'), ...summary.questions.map((question, index) => `  ${index + 1}. ${question}`));
  lines.push('', muted(NOTE));
  return lines.join('\n');
}

/** The --json output (public format, French keys). */
export const toJson = (summary) => ({
  fichiers: summary.fileCount,
  ajouts: summary.additions,
  suppressions: summary.deletions,
  commits: summary.commits,
  genres: summary.byCategory.map((category) => ({ genre: category.id, fichiers: category.count, ajouts: category.additions, suppressions: category.deletions })),
  points: summary.signals.map((signal) => ({ regle: signal.rule, message: signal.message, fichiers: signal.files })),
  questions: summary.questions,
});
