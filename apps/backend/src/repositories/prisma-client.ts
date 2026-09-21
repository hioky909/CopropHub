import { PrismaClient } from '@prisma/client';

/**
 * Point d'entrée unique vers Prisma. Seuls les fichiers de `repositories/`
 * importent ce module — un controller ou un service qui importerait
 * @prisma/client directement serait une anomalie visible à la revue de
 * code (cf. ADR-001, § Mapping explicite avec l'architecture 3 couches).
 *
 * Instanciation paresseuse (au premier accès réel à la base, pas à
 * l'import du module) : un test qui construit l'application pour vérifier
 * une route ne touchant pas la base (ex. /health) ne doit pas échouer
 * simplement parce que `prisma generate` n'a pas encore été exécuté dans
 * l'environnement courant.
 */
let instance: PrismaClient | undefined;

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_cible, propriete: keyof PrismaClient) {
    instance ??= new PrismaClient();
    return instance[propriete];
  },
});
