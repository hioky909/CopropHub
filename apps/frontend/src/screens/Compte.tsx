import { useState, type FormEvent } from "react";
import Button from "../components/Button.js";
import { TextField } from "../components/FormField.js";
import Notification from "../components/Notification.js";
import { authApi } from "../api/auth.js";
import { ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import AvatarProfil from "../components/AvatarProfil.js";
import EditeurApparence from "../components/EditeurApparence.js";
import PreferencesNotifications from "../components/PreferencesNotifications.js";
import { libelleRole } from "../utils/format.js";

/** Mon compte : changement de son propre mot de passe (le mot de passe actuel est exigé) et apparence. */
export default function Compte() {
  const { utilisateur } = useAuth();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(false);
    if (nouveau !== confirmation) {
      setErreur("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setEnvoi(true);
    try {
      await authApi.changerMotDePasse(actuel, nouveau);
      setSucces(true);
      setActuel("");
      setNouveau("");
      setConfirmation("");
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? err.message
          : "Impossible de changer le mot de passe.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>
      <h1
        style={{
          margin: "0 0 4px",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--color-neutral-900)",
          letterSpacing: "-0.02em",
        }}
      >
        Mon compte
      </h1>
      {utilisateur && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0 24px" }}>
          <AvatarProfil graine={utilisateur.id} taille={56} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--color-neutral-900)" }}>{utilisateur.email}</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-primary)" }}>{libelleRole(utilisateur)}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={soumettre}
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-neutral-200)",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--color-neutral-900)",
          }}
        >
          Changer mon mot de passe
        </h2>
        {erreur && <Notification variant="error">{erreur}</Notification>}
        {succes && (
          <Notification variant="success">Mot de passe modifié.</Notification>
        )}
        <TextField
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          value={actuel}
          onChange={(e) => setActuel(e.target.value)}
        />
        <TextField
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          help="12 caractères minimum."
        />
        <TextField
          label="Confirmer le nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={envoi}>
          Modifier le mot de passe
        </Button>
      </form>

      <PreferencesNotifications />

      <EditeurApparence />
    </main>
  );
}
