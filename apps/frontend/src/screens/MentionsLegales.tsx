import type { ReactNode } from "react";
import { LogoHorizontal } from "../components/Logo.js";

/**
 * Mentions légales et politique de confidentialité (RGPD) — écran PUBLIC, accessible sans
 * connexion (comme /connexion). Comble un manque relevé lors de l'audit pré-production : aucune
 * information légale n'existait alors que l'application traite des données personnelles et
 * financières (comptes, votes, charges, incidents). Contenu générique à personnaliser par le
 * syndic exploitant l'installation (raison sociale, adresse, contact réels) — cf. Doc 8.
 */

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--color-neutral-900)",
          margin: "0 0 8px",
        }}
      >
        {titre}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-neutral-700)" }}>
        {children}
      </div>
    </section>
  );
}

export default function MentionsLegales() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 64px" }}>
      <div style={{ marginBottom: 24 }}>
        <LogoHorizontal taille={32} />
      </div>
      <h1
        style={{
          margin: "0 0 24px",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--color-neutral-900)",
          letterSpacing: "-0.02em",
        }}
      >
        Mentions légales et confidentialité
      </h1>

      <Section titre="Responsable de traitement">
        <p style={{ margin: 0 }}>
          Le syndic de copropriété utilisant cette installation de CopropHub est responsable du
          traitement des données saisies (nom, adresse email, votes, incidents, charges). Ses
          coordonnées de contact figurent sur les convocations et communications habituelles de
          l’immeuble, ou peuvent être obtenues auprès de lui directement.
        </p>
      </Section>

      <Section titre="Données collectées et finalités">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Identité et email : création du compte, authentification, communication</li>
          <li>Votes en assemblée générale : décompte des résultats (jamais publiés nominativement)</li>
          <li>Incidents déclarés : suivi et résolution des désordres de l’immeuble</li>
          <li>Charges de copropriété : suivi comptable des sommes dues par lot</li>
        </ul>
      </Section>

      <Section titre="Base légale">
        <p style={{ margin: 0 }}>
          Exécution du mandat de syndic et obligations légales de gestion de la copropriété (loi
          du 10 juillet 1965 et ses décrets d’application). Aucune donnée n’est utilisée à des
          fins commerciales ou transmise à un tiers en dehors de la gestion de l’immeuble.
        </p>
      </Section>

      <Section titre="Durée de conservation">
        <p style={{ margin: 0 }}>
          Les données sont conservées le temps du mandat de syndic en cours, puis archivées selon
          les délais légaux applicables à la gestion des copropriétés (documents comptables et
          procès-verbaux d’assemblée générale notamment).
        </p>
      </Section>

      <Section titre="Vos droits">
        <p style={{ margin: 0 }}>
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
          Informatique et Libertés, vous disposez d’un droit d’accès, de rectification,
          d’effacement et d’opposition sur vos données personnelles. Pour l’exercer, contactez le
          syndic de votre immeuble. Vous pouvez également introduire une réclamation auprès de la
          CNIL (
          <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
            www.cnil.fr
          </a>
          ).
        </p>
      </Section>

      <Section titre="Cookies">
        <p style={{ margin: 0 }}>
          CopropHub utilise un unique cookie technique, strictement nécessaire à votre connexion
          (maintien de la session), effacé à la déconnexion ou après 8 heures. Aucun cookie de
          mesure d’audience ni de publicité n’est déposé, et aucune donnée n’est partagée avec un
          service tiers.
        </p>
      </Section>

      <Section titre="Hébergement et sécurité">
        <p style={{ margin: 0 }}>
          Les données sont hébergées sur l’infrastructure choisie par le syndic exploitant cette
          installation. Les mots de passe sont chiffrés (jamais stockés en clair), les connexions
          sont protégées par HTTPS, et l’accès à chaque donnée est vérifié individuellement selon
          votre rôle (copropriétaire, membre du conseil syndical, syndic).
        </p>
      </Section>
    </main>
  );
}
