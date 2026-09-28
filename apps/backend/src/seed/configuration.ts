/**
 * Configuration du script d'amorçage (`prisma/seed.ts`) : l'immeuble unique et le premier compte
 * syndic. En développement, des valeurs par défaut pratiques existent ; en production, RIEN n'a de
 * valeur par défaut — un mot de passe connu de tous dans le dépôt serait une porte d'entrée. Les
 * valeurs viennent alors de variables d'environnement `SEED_*` et sont validées.
 */
export interface ConfigurationSeed {
  immeuble: { nom: string; adresse: string };
  syndic: { nom: string; email: string; motDePasse: string };
}

export class ConfigurationSeedInvalideError extends Error {
  constructor(public readonly problemes: string[]) {
    super(`Configuration d'amorçage invalide :\n- ${problemes.join('\n- ')}`);
    this.name = 'ConfigurationSeedInvalideError';
  }
}

const LONGUEUR_MIN_MOT_DE_PASSE = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAR_DEFAUT = {
  immeubleNom: 'Résidence Exemple',
  immeubleAdresse: '1 rue Exemple, 75000 Paris',
  syndicNom: 'Syndic par défaut',
  syndicEmail: 'syndic@coprophub.local',
  syndicMotDePasse: 'changez-ce-mot-de-passe',
};

export function lireConfigurationSeed(env: Record<string, string | undefined>): ConfigurationSeed {
  const production = env.NODE_ENV === 'production';
  const valeur = (cle: string, defaut: string): string => {
    const brut = env[cle]?.trim();
    return brut ? brut : production ? '' : defaut;
  };

  const configuration: ConfigurationSeed = {
    immeuble: {
      nom: valeur('SEED_IMMEUBLE_NOM', PAR_DEFAUT.immeubleNom),
      adresse: valeur('SEED_IMMEUBLE_ADRESSE', PAR_DEFAUT.immeubleAdresse),
    },
    syndic: {
      nom: valeur('SEED_SYNDIC_NOM', PAR_DEFAUT.syndicNom),
      email: valeur('SEED_SYNDIC_EMAIL', PAR_DEFAUT.syndicEmail).toLowerCase(),
      // Le mot de passe n'est jamais « trimé » : les espaces en fin de mot de passe sont significatifs.
      motDePasse: env.SEED_SYNDIC_MOT_DE_PASSE
        ? env.SEED_SYNDIC_MOT_DE_PASSE
        : production
          ? ''
          : PAR_DEFAUT.syndicMotDePasse,
    },
  };

  const problemes: string[] = [];
  if (!configuration.immeuble.nom) problemes.push('SEED_IMMEUBLE_NOM est requis en production.');
  if (configuration.immeuble.nom.length > 120)
    problemes.push('SEED_IMMEUBLE_NOM dépasse 120 caractères.');
  if (!configuration.immeuble.adresse)
    problemes.push('SEED_IMMEUBLE_ADRESSE est requis en production.');
  if (!configuration.syndic.nom) problemes.push('SEED_SYNDIC_NOM est requis en production.');
  if (configuration.syndic.nom.length > 120)
    problemes.push('SEED_SYNDIC_NOM dépasse 120 caractères.');
  if (!EMAIL.test(configuration.syndic.email))
    problemes.push('SEED_SYNDIC_EMAIL doit être une adresse email valide.');
  if (configuration.syndic.motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    problemes.push(
      `SEED_SYNDIC_MOT_DE_PASSE est requis et doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`,
    );
  }
  if (production && configuration.syndic.motDePasse === PAR_DEFAUT.syndicMotDePasse) {
    problemes.push(
      'SEED_SYNDIC_MOT_DE_PASSE ne doit pas être le mot de passe par défaut du dépôt.',
    );
  }
  if (problemes.length > 0) throw new ConfigurationSeedInvalideError(problemes);
  return configuration;
}
