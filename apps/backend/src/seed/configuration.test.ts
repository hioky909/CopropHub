import { describe, expect, it } from 'vitest';
import { ConfigurationSeedInvalideError, lireConfigurationSeed } from './configuration.js';

const COMPLETE = {
  NODE_ENV: 'production',
  SEED_IMMEUBLE_NOM: 'Résidence des Tilleuls',
  SEED_IMMEUBLE_ADRESSE: '12 rue des Lilas, 75011 Paris',
  SEED_SYNDIC_NOM: 'Cabinet Martin',
  SEED_SYNDIC_EMAIL: 'Contact@Cabinet-Martin.fr',
  SEED_SYNDIC_MOT_DE_PASSE: 'un-mot-de-passe-vraiment-solide',
};

function problemes(env: Record<string, string | undefined>): string[] {
  try {
    lireConfigurationSeed(env);
    return [];
  } catch (erreur) {
    expect(erreur).toBeInstanceOf(ConfigurationSeedInvalideError);
    return (erreur as ConfigurationSeedInvalideError).problemes;
  }
}

describe('lireConfigurationSeed — développement', () => {
  it('sans rien configurer, garde les valeurs pratiques de développement', () => {
    const c = lireConfigurationSeed({});
    expect(c.immeuble.nom).toBe('Résidence Exemple');
    expect(c.syndic.email).toBe('syndic@coprophub.local');
    expect(c.syndic.motDePasse).toBe('changez-ce-mot-de-passe');
  });

  it('les variables SEED_* l’emportent sur les valeurs par défaut', () => {
    const c = lireConfigurationSeed({ SEED_IMMEUBLE_NOM: 'Mon immeuble', SEED_SYNDIC_MOT_DE_PASSE: 'un-autre-mot-de-passe-12' });
    expect(c.immeuble.nom).toBe('Mon immeuble');
    expect(c.syndic.motDePasse).toBe('un-autre-mot-de-passe-12');
  });
});

describe('lireConfigurationSeed — production', () => {
  it('accepte une configuration complète, normalise l’email en minuscules, retire les espaces autour des noms', () => {
    const c = lireConfigurationSeed({ ...COMPLETE, SEED_IMMEUBLE_NOM: '  Résidence des Tilleuls  ' });
    expect(c.syndic.email).toBe('contact@cabinet-martin.fr');
    expect(c.immeuble.nom).toBe('Résidence des Tilleuls');
    expect(c.syndic.motDePasse).toBe('un-mot-de-passe-vraiment-solide');
  });

  it('n’a AUCUNE valeur par défaut : tout manque est signalé, y compris le mot de passe', () => {
    expect(problemes({ NODE_ENV: 'production' })).toEqual([
      'SEED_IMMEUBLE_NOM est requis en production.',
      'SEED_IMMEUBLE_ADRESSE est requis en production.',
      'SEED_SYNDIC_NOM est requis en production.',
      'SEED_SYNDIC_EMAIL doit être une adresse email valide.',
      'SEED_SYNDIC_MOT_DE_PASSE est requis et doit faire au moins 12 caractères.',
    ]);
  });

  it('refuse le mot de passe par défaut du dépôt', () => {
    expect(problemes({ ...COMPLETE, SEED_SYNDIC_MOT_DE_PASSE: 'changez-ce-mot-de-passe' })).toContain(
      'SEED_SYNDIC_MOT_DE_PASSE ne doit pas être le mot de passe par défaut du dépôt.',
    );
  });

  it.each(['court', '12345678901'])('refuse un mot de passe de moins de 12 caractères (« %s »)', (motDePasse) => {
    expect(problemes({ ...COMPLETE, SEED_SYNDIC_MOT_DE_PASSE: motDePasse })).toEqual([
      'SEED_SYNDIC_MOT_DE_PASSE est requis et doit faire au moins 12 caractères.',
    ]);
  });

  it.each(['pas-un-email', 'a@b', '@b.fr', 'a b@c.fr', ''])('refuse l’email invalide « %s »', (email) => {
    expect(problemes({ ...COMPLETE, SEED_SYNDIC_EMAIL: email })).toContain('SEED_SYNDIC_EMAIL doit être une adresse email valide.');
  });

  it('refuse des noms trop longs (limite de la colonne)', () => {
    const long = 'x'.repeat(121);
    expect(problemes({ ...COMPLETE, SEED_IMMEUBLE_NOM: long, SEED_SYNDIC_NOM: long })).toEqual([
      'SEED_IMMEUBLE_NOM dépasse 120 caractères.',
      'SEED_SYNDIC_NOM dépasse 120 caractères.',
    ]);
  });

  it('ne « trime » pas le mot de passe : les espaces comptent', () => {
    const c = lireConfigurationSeed({ ...COMPLETE, SEED_SYNDIC_MOT_DE_PASSE: '  espaces autour  ' });
    expect(c.syndic.motDePasse).toBe('  espaces autour  ');
  });

  it('un mot de passe fait uniquement de quelques espaces reste refusé car trop court', () => {
    expect(problemes({ ...COMPLETE, SEED_SYNDIC_MOT_DE_PASSE: '   ' })).toEqual([
      'SEED_SYNDIC_MOT_DE_PASSE est requis et doit faire au moins 12 caractères.',
    ]);
  });
});
