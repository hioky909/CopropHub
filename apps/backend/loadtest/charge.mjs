#!/usr/bin/env node
/**
 * Test de charge (Phase 5/compétence 9 de l'audit : jamais fait jusqu'ici, aucun outil en place).
 * Script Node PUR — aucune dépendance ajoutée : `artillery` et `autocannon` traînent tous deux une
 * vulnérabilité modérée transitive (uuid <11.1.1 via hyperid) sans version qui l'évite ; ce script
 * fait le strict nécessaire (fetch natif, cookie de session par « utilisateur virtuel », latences
 * par route) sans en payer le poids ni le risque de dépendance.
 *
 * Usage :
 *   BASE_URL=http://localhost:3001 ORIGINE=http://localhost:5199 \
 *   CONCURRENCE=10 DUREE_S=30 node loadtest/charge.mjs
 *
 * Comptes utilisés : ceux de `scripts/e2e-seed.ts` (base de test jetable, JAMAIS la base de dev/prod
 * réelle — le garde-fou `_test` de `setup.ts` s'applique à qui démarre le backend, pas à ce script).
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
const ORIGINE = process.env.ORIGINE ?? 'http://localhost:5199';
const CONCURRENCE = Number(process.env.CONCURRENCE ?? 10);
const DUREE_S = Number(process.env.DUREE_S ?? 30);

const SYNDIC = { email: 'e2e-syndic@coprophub.local', motDePasse: 'un-mot-de-passe-e2e-syndic-1' };
const COPRO = { email: 'e2e-copro@coprophub.local', motDePasse: 'un-mot-de-passe-e2e-copro-1' };

/** { route: [{ ms, ok }] } */
const mesures = new Map();

function enregistrer(route, ms, ok) {
  const liste = mesures.get(route) ?? [];
  liste.push({ ms, ok });
  mesures.set(route, liste);
}

async function appeler(route, options, cookie) {
  const debut = performance.now();
  let ok = false;
  let nouveauCookie = cookie;
  try {
    const reponse = await fetch(`${BASE_URL}${route}`, {
      ...options,
      headers: { Origin: ORIGINE, ...(cookie ? { Cookie: cookie } : {}), ...(options?.headers ?? {}) },
    });
    ok = reponse.status < 400;
    const recus = reponse.headers.getSetCookie?.() ?? [];
    if (recus.length > 0) nouveauCookie = recus.map((c) => c.split(';')[0]).join('; ');
    // Consomme le corps pour libérer la connexion (sinon fetch garde la socket ouverte).
    await reponse.arrayBuffer();
  } catch {
    ok = false;
  }
  enregistrer(route, performance.now() - debut, ok);
  return nouveauCookie;
}

async function scenarioAnonyme() {
  await appeler('/health', { method: 'GET' });
}

async function scenarioSyndic() {
  let cookie;
  cookie = await appeler(
    '/auth/connexion',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(SYNDIC) },
    cookie,
  );
  await appeler('/ags', { method: 'GET' }, cookie);
  await appeler('/charges', { method: 'GET' }, cookie);
  await appeler('/incidents', { method: 'GET' }, cookie);
}

async function scenarioCopro() {
  let cookie;
  cookie = await appeler(
    '/auth/connexion',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(COPRO) },
    cookie,
  );
  await appeler('/charges', { method: 'GET' }, cookie);
  await appeler('/auth/moi', { method: 'GET' }, cookie);
}

const SCENARIOS = [
  { poids: 2, fn: scenarioAnonyme },
  { poids: 4, fn: scenarioSyndic },
  { poids: 4, fn: scenarioCopro },
];
const TOTAL_POIDS = SCENARIOS.reduce((s, x) => s + x.poids, 0);

function choisirScenario() {
  let tirage = Math.random() * TOTAL_POIDS;
  for (const s of SCENARIOS) {
    if (tirage < s.poids) return s.fn;
    tirage -= s.poids;
  }
  return SCENARIOS[0].fn;
}

async function utilisateurVirtuel(fin) {
  while (Date.now() < fin) {
    await choisirScenario()();
  }
}

function percentile(triees, p) {
  if (triees.length === 0) return 0;
  const i = Math.min(triees.length - 1, Math.floor((p / 100) * triees.length));
  return triees[i];
}

console.log(`Test de charge — ${BASE_URL} — ${CONCURRENCE} utilisateurs virtuels pendant ${DUREE_S}s\n`);
const fin = Date.now() + DUREE_S * 1000;
await Promise.all(Array.from({ length: CONCURRENCE }, () => utilisateurVirtuel(fin)));

// /auth/connexion et /auth/mot-de-passe : dominées par bcrypt (facteur 12), délibérément coûteux
// (résistance à la force brute, cf. mot-de-passe.service.ts) — pas comparables aux routes de
// lecture. Seuil séparé, plus large, pour ne pas confondre un coût de sécurité voulu avec un
// défaut de performance.
const SEUIL_MS_BCRYPT = 1000;
const SEUIL_MS_DEFAUT = 500;
const routeBcrypt = (route) => route.startsWith('/auth/connexion') || route.startsWith('/auth/mot-de-passe') || route.startsWith('/auth/inscription');

console.log('Route'.padEnd(20), 'Req'.padStart(6), 'Erreurs'.padStart(8), 'p50 ms'.padStart(8), 'p95 ms'.padStart(8), 'p99 ms'.padStart(8), 'max ms'.padStart(8));
let totalReq = 0;
let totalErreurs = 0;
let seuilsDepasses = 0;
for (const [route, liste] of [...mesures.entries()].sort()) {
  const triees = liste.map((x) => x.ms).sort((a, b) => a - b);
  const erreurs = liste.filter((x) => !x.ok).length;
  const p95 = percentile(triees, 95);
  totalReq += liste.length;
  totalErreurs += erreurs;
  const seuil = routeBcrypt(route) ? SEUIL_MS_BCRYPT : SEUIL_MS_DEFAUT;
  if (p95 > seuil) seuilsDepasses += 1;
  console.log(
    route.padEnd(20),
    String(liste.length).padStart(6),
    String(erreurs).padStart(8),
    percentile(triees, 50).toFixed(1).padStart(8),
    `${p95.toFixed(1)}${p95 > seuil ? '!' : ''}`.padStart(8),
    percentile(triees, 99).toFixed(1).padStart(8),
    Math.max(...triees).toFixed(1).padStart(8),
  );
}
const tauxErreur = totalReq > 0 ? (100 * totalErreurs) / totalReq : 0;
console.log(`\n${totalReq} requêtes, ${totalErreurs} erreurs (${tauxErreur.toFixed(2)}%)`);
console.log(`Seuils : p95 < ${SEUIL_MS_DEFAUT} ms (lecture) / < ${SEUIL_MS_BCRYPT} ms (auth, bcrypt) — '!' = dépassé ci-dessus.`);

if (totalErreurs > 0 || seuilsDepasses > 0) {
  console.error(`\n${seuilsDepasses} route(s) au-dessus de leur seuil, ${totalErreurs} erreur(s).`);
  process.exitCode = 1;
}
