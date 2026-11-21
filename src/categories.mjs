/** The kind of each changed file, from its path. The first matching category wins. */
export const CATEGORIES = [
  ['agent', 'consignes d’agent', /(^|\/)(AGENTS\.md|CLAUDE\.md|GEMINI\.md|\.cursorrules|SKILL\.md)$|(^|\/)\.(claude|cursor|agents)\//],
  ['ci', 'intégration continue', /^\.github\/(workflows|actions)\/|(^|\/)action\.ya?ml$|(^|\/)\.gitlab-ci\.yml$/],
  ['dependencies', 'dépendances', /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|pyproject\.toml|poetry\.lock|go\.mod|go\.sum|Cargo\.toml|Cargo\.lock|Gemfile(\.lock)?)$/],
  ['migration', 'migrations de base de données', /(^|\/)migrations?\//],
  ['test', 'tests', /(^|\/)(test|tests|__tests__|e2e|spec)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$/],
  ['docs', 'documentation', /\.(md|mdx|rst|txt)$|(^|\/)docs?\//],
  ['config', 'configuration', /(^|\/)\.[^/]+$|\.(json|ya?ml|toml|ini|conf|config\.[a-z]+)$|(^|\/)Dockerfile$/],
  ['code', 'code', /./],
];

export function categoryOf(path) {
  const [categoryId] = CATEGORIES.find(([, , pattern]) => pattern.test(path));
  return categoryId;
}

export const categoryLabel = (wantedId) => CATEGORIES.find(([categoryId]) => categoryId === wantedId)[1];
