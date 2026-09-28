import { createClient, type RedisClientType } from 'redis';
import { RedisStore } from 'rate-limit-redis';

/**
 * Data Access Layer — client Redis PARTAGÉ ENTRE INSTANCES (compétence 8, Repositoire NoSQL) :
 * révocation de session au logout et compteurs de rate limiting. Strictement optionnel — tout le
 * reste de l'application (données métier) reste exclusivement PostgreSQL/Prisma (RM du MPD, Doc 3) ;
 * Redis n'héberge ici qu'un état technique éphémère (TTL sur chaque clé), jamais une donnée métier.
 *
 * Sans `REDIS_URL` (dev, tests unitaires, petite installation mono-instance) : chaque appelant se
 * rabat sur un état en mémoire du processus — comportement inchangé par rapport à avant, documenté
 * comme limitation acceptable pour une seule instance (cf. Doc 5). Avec `REDIS_URL` (production
 * multi-instance) : la révocation de session et les compteurs de rate limiting sont partagés entre
 * toutes les instances du backend.
 */

let instance: RedisClientType | undefined;
let connexion: Promise<RedisClientType> | undefined;

export function redisConfigure(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/** Connexion paresseuse, réutilisée. Ne lance jamais : un appelant qui échoue à se connecter doit se rabattre sur son magasin en mémoire, jamais faire échouer une requête HTTP. */
export async function redisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (instance) return instance;
  connexion ??= (async () => {
    const client: RedisClientType = createClient({ url });
    client.on('error', (erreur: unknown) => {
      // eslint-disable-next-line no-console -- pas de donnée personnelle, juste un message technique.
      console.error(
        JSON.stringify({
          type: 'redis_erreur',
          message: erreur instanceof Error ? erreur.message : 'erreur inconnue',
        }),
      );
    });
    await client.connect();
    instance = client;
    return client;
  })();

  try {
    return await connexion;
  } catch (erreur) {
    connexion = undefined; // permet une nouvelle tentative au prochain appel
    // eslint-disable-next-line no-console -- pas de donnée personnelle.
    console.error(
      JSON.stringify({
        type: 'redis_connexion_echouee',
        message: erreur instanceof Error ? erreur.message : 'erreur inconnue',
      }),
    );
    return null;
  }
}

/**
 * Magasin `express-rate-limit` partagé entre instances : `undefined` si `REDIS_URL` n'est pas
 * défini, auquel cas l'appelant obtient le magasin en mémoire par défaut d'`express-rate-limit`
 * (comportement inchangé, mono-instance). La connexion réelle n'est établie qu'à la première
 * requête qui en a besoin (paresseuse), jamais à la construction de l'application.
 */
export function magasinLimiteRedis(prefixe: string): RedisStore | undefined {
  if (!redisConfigure()) return undefined;
  return new RedisStore({
    prefix: prefixe,
    sendCommand: async (...args: string[]) => {
      const client = await redisClient();
      if (!client) throw new Error('Redis indisponible (rate limiting).');
      return client.sendCommand(args);
    },
  });
}

/** Pour les tests et l'arrêt propre du serveur. */
export async function redisFermer(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = undefined;
    connexion = undefined;
  }
}
