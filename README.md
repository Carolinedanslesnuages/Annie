# Annie

Le résumé d'une pull request, pour la personne qui la relit.

Le nom rend hommage à Annie Ernaux, prix Nobel de littérature 2022, qui qualifie d'« écriture
plate » son style factuel, sans effets : Annie résume une PR de la même façon.

Un agent de code écrit vite, et beaucoup. Relire sa PR demande de savoir d'abord **ce qui
change vraiment** et **où regarder**. Annie lit le diff et le dit, sans enjoliver : des faits,
pas un avis.

```text
Résumé pour la relecture
7 fichiers · +214 −38 · 3 commits

  code              4  +180 −30
  tests             1  +20 −8
  dépendances       1  +2 −0

Points d'attention
  ! Des vérifications (assert, expect) sont retirées de test/panier.test.js.
  ! Dépendances ajoutée(s) : date-fns.
  ! Nouvelle(s) variable(s) d'environnement lue(s) : STRIPE_KEY.

Questions à poser
  1. Pourquoi ces vérifications ont-elles disparu ?
  2. Chaque nouvelle dépendance est-elle nécessaire, ancienne d'au moins deux semaines et sous
     une licence compatible ? (Madeleine le vérifie.)
  3. Ces variables sont-elles documentées (README ou .env.example) et configurées là où le
     projet tourne ?
```

## Ce qu'Annie relève

| Point | Quand |
|---|---|
| `tests-supprimes` | Un fichier de test est supprimé. |
| `tests-desactives` | Un test est désactivé ou isolé (`.skip`, `.only`, `.todo`, `xit`, `@Disabled`…). |
| `verifications-retirees` | Un fichier de test perd plus de vérifications (`assert`, `expect`) qu'il n'en gagne. |
| `code-sans-test` | Le code change sans qu'aucun test ne change. |
| `consignes-agent` | `AGENTS.md`, `CLAUDE.md`, une skill ou un dossier `.claude/` change. |
| `droits-ci` | Un workflow demande des droits (`permissions`, `contents: write`…). |
| `ci-modifiee` | Un workflow ou une action change. |
| `dependances` | Des dépendances sont ajoutées, changent de version ou sont retirées (lues dans `package.json`). |
| `verrou-dependances` | Le fichier de verrouillage change sans qu'aucune dépendance déclarée ne change. |
| `migrations` | Une migration de base de données change. |
| `variables-env` | Le code lit une nouvelle variable d'environnement. |
| `fichiers-supprimes` | Des fichiers sont supprimés. |
| `a-faire` | Des `TODO` ou `FIXME` sont ajoutés. |
| `gros-ajouts` | Plus de 400 lignes ajoutées dans un seul fichier. |

Chaque point vient avec la question à poser. Une simple nouvelle version publiée (le champ
`version` de `package.json` et de son fichier de verrouillage) ne déclenche rien.

**Ce qu'Annie ne fait pas** : juger la logique, la pertinence ou le style. Elle dit où regarder ;
la relecture reste humaine.

## Dans une pull request (GitHub Actions)

```yaml
name: Annie

on:
  pull_request:

permissions:
  contents: read

jobs:
  resume:
    name: Résumé pour la relecture (Annie)
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          fetch-depth: 0
      - uses: Carolinedanslesnuages/annie@v1
```

Le résumé arrive en commentaire de la PR, et ce même commentaire est mis à jour à chaque
nouveau commit. Sans droit d'écriture (PR venue d'une fourche), il reste dans le résumé du
contrôle. `commenter: "false"` le garde seulement là.

## Sur votre ordinateur

```sh
npx github:Carolinedanslesnuages/annie              # la branche courante, comparée à main
npx github:Carolinedanslesnuages/annie --base develop
npx github:Carolinedanslesnuages/annie --markdown   # à coller dans la description d'une PR
```

| Option | Rôle |
|---|---|
| `--base <ref>` | Branche ou commit de départ (défaut : `origin/main`, sinon `main`). |
| `--head <ref>` | Branche à résumer (défaut : `HEAD`). |
| `--markdown` | En Markdown. |
| `--json` | En JSON. |

Rien n'est envoyé : Annie lit seulement l'historique git du dossier courant. Aucune IA, aucun
service extérieur.

## Pourquoi Annie

[Annie Ernaux](https://fr.wikipedia.org/wiki/Annie_Ernaux), prix Nobel de littérature 2022,
parle de son « écriture plate » : dire les faits, sans les enjoliver ni les juger. C'est le ton
d'un bon résumé de PR.

## Développer Annie

```sh
npm test
```

Les tests créent des dépôts git jetables : PR propre, tests supprimés ou désactivés,
vérifications retirées, consignes d'agent, droits de workflow, dépendances, nouvelle version
publiée, migrations, variables, Markdown du commentaire.

## Licence

[MIT](LICENSE).
