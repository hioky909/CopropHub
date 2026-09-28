import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Couverture COMBINÉE unitaire + intégration (Phase 3 de l'audit : lue séparément, la couverture
 * unitaire seule est trompeuse — les repositories et deux contrôleurs (auth, utilisateurs) sont
 * couverts par les tests d'intégration, pas par des tests unitaires dédiés, cf. Doc 10). Fusionne
 * les deux rapports v8 (json brut) avec `nyc merge`, script Node portable (Windows/Linux/macOS) —
 * les scripts npm avec `&&`/`mkdir -p` ne le sont pas de façon fiable sous `cmd.exe`.
 *
 * Exige DATABASE_URL (base de test PostgreSQL réelle, nom finissant par `_test`) pour la partie
 * intégration — mêmes garde-fous que `npm run test:integration` (cf. src/integration/setup.ts).
 */
const racine = process.cwd();
const dossierCouverture = join(racine, 'coverage');
const brut = join(dossierCouverture, 'brut');
const fusionDir = join(dossierCouverture, 'fusion');

/**
 * `execSync` (pas `execFileSync` + `shell: true`, qui émet un avertissement de dépréciation Node
 * sur les arguments non échappés) : chaque argument passé ici est un littéral fixe de ce fichier,
 * jamais une entrée externe, donc rien à échapper.
 */
function executer(args) {
  execSync(`npx ${args.join(' ')}`, { stdio: 'inherit' });
}

mkdirSync(brut, { recursive: true });
mkdirSync(fusionDir, { recursive: true });

// eslint-disable-next-line no-console -- script CLI : la sortie console est son interface
console.log('--- Tests unitaires (avec couverture) ---');
executer([
  'vitest',
  'run',
  '--coverage',
  '--coverage.reportsDirectory=coverage/unitaire',
  '--coverage.reporter=json',
]);
copyFileSync(join(dossierCouverture, 'unitaire', 'coverage-final.json'), join(brut, 'unitaire.json'));

// eslint-disable-next-line no-console -- script CLI
console.log('--- Tests d’intégration (avec couverture, base PostgreSQL réelle) ---');
executer([
  'vitest',
  'run',
  '--config',
  'src/integration/vitest.config.ts',
  '--coverage',
  '--coverage.reportsDirectory=coverage/integration',
  '--coverage.reporter=json',
]);
const integrationJson = join(dossierCouverture, 'integration', 'coverage-final.json');
if (!existsSync(integrationJson)) {
  throw new Error(
    "Rapport d'intégration introuvable : DATABASE_URL est-elle définie (base de test PostgreSQL réelle) ?",
  );
}
copyFileSync(integrationJson, join(brut, 'integration.json'));

// eslint-disable-next-line no-console -- script CLI
console.log('--- Fusion (nyc merge) puis rapport combiné ---');
executer(['nyc', 'merge', 'coverage/brut', 'coverage/fusion/coverage-final.json']);
executer([
  'nyc',
  'report',
  '--temp-dir',
  'coverage/fusion',
  '--reporter',
  'text-summary',
  '--reporter',
  'html',
  '--report-dir',
  'coverage/combinee',
]);

// eslint-disable-next-line no-console -- script CLI
console.log(`\nRapport HTML combiné : ${join(racine, 'coverage', 'combinee', 'index.html')}`);
