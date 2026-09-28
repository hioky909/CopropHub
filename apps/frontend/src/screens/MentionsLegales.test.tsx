import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MentionsLegales from "./MentionsLegales.js";

/**
 * Comble le manque RGPD relevé lors de l'audit pré-production (Phase 4) : aucune page
 * mentions légales/confidentialité n'existait. Vérifie que l'écran expose réellement les
 * informations attendues (responsable de traitement, droits RGPD, cookies), pas seulement
 * qu'il se rend sans erreur.
 */
function rendre() {
  return render(
    <MemoryRouter initialEntries={["/mentions-legales"]}>
      <MentionsLegales />
    </MemoryRouter>,
  );
}

describe("MentionsLegales", () => {
  it("a un titre de niveau 1 unique", () => {
    rendre();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mentions légales et confidentialité",
    );
  });

  it("informe sur le responsable de traitement et les finalités", () => {
    rendre();
    expect(screen.getByText(/Responsable de traitement/i)).toBeInTheDocument();
    expect(screen.getByText(/Données collectées et finalités/i)).toBeInTheDocument();
    expect(screen.getByText(/Votes en assemblée générale/i)).toBeInTheDocument();
  });

  it("mentionne les droits RGPD et un lien vers la CNIL", () => {
    rendre();
    expect(screen.getByText(/droit d.accès, de rectification/i)).toBeInTheDocument();
    const lienCnil = screen.getByRole("link", { name: /cnil/i });
    expect(lienCnil).toHaveAttribute("href", "https://www.cnil.fr");
  });

  it("précise qu'un seul cookie technique est utilisé, sans mesure d'audience ni publicité", () => {
    rendre();
    expect(screen.getByText(/unique cookie technique/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucun cookie de/i)).toBeInTheDocument();
  });
});
