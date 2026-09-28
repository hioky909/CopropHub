/**
 * Garde-fou exécuté avant CHAQUE fichier de test d'intégration.
 *
 * Ces tests vident les tables (`TRUNCATE`). Une mauvaise `DATABASE_URL`
 * pointant vers une base de développement ou de production détruirait de
 * vraies données : on refuse donc de démarrer si la variable est absente ou
 * si le nom de la base ne se termine pas par `_test`.
 */
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL absente : les tests d'intégration exigent une base PostgreSQL de test (nom se terminant par _test).",
  );
}

const nomBase = new URL(url).pathname.replace(/^\//, '');
if (!nomBase.endsWith('_test')) {
  throw new Error(
    `Refus d'exécuter les tests d'intégration sur la base "${nomBase}" : son nom doit se terminer par "_test" (ils vident les tables).`,
  );
}

process.env.SESSION_SECRET ??= 'secret-de-test-pour-les-tests-uniquement';

// Si REDIS_URL est fourni (redis-partage.integration.test.ts, CI), les compteurs de rate limiting
// sont RÉELLEMENT partagés entre tous les fichiers de test de cette exécution (c'est justement ce
// qu'on veut prouver) — il faut donc les vider avant chaque fichier, sinon un fichier hérite du
// quota déjà consommé par un précédent (contrairement au repli en mémoire, isolé par défaut).
if (process.env.REDIS_URL) {
  const { createClient } = await import('redis');
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const cles = await client.keys('rl_*');
  if (cles.length > 0) await client.del(cles);
  await client.quit();
}
