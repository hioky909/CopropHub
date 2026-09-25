const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requete<T>(
  chemin: string,
  options: { methode?: string; corps?: unknown } = {},
): Promise<T> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: options.methode ?? 'GET',
    credentials: 'include',
    headers: options.corps !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
  });

  if (reponse.status === 204) {
    return undefined as T;
  }

  const corps = await reponse.json().catch(() => ({}));

  if (!reponse.ok) {
    throw new ApiError(reponse.status, corps.erreur ?? 'Une erreur est survenue.');
  }

  return corps as T;
}

/**
 * Télécharge un fichier généré par le serveur (PDF) avec le cookie de session : un simple lien vers
 * l'API n'enverrait pas le cookie si le front et l'API sont sur des sites différents. Le nom du
 * fichier est choisi par l'appelant ; en cas d'erreur, le message de l'API est remonté.
 */
async function telecharger(chemin: string, nomFichier: string): Promise<void> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, { credentials: 'include' });
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}));
    throw new ApiError(reponse.status, corps.erreur ?? 'Une erreur est survenue.');
  }
  const url = URL.createObjectURL(await reponse.blob());
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const api = {
  telecharger,
  get: <T>(chemin: string) => requete<T>(chemin),
  post: <T>(chemin: string, corps?: unknown) => requete<T>(chemin, { methode: 'POST', corps: corps ?? {} }),
  patch: <T>(chemin: string, corps?: unknown) => requete<T>(chemin, { methode: 'PATCH', corps: corps ?? {} }),
  put: <T>(chemin: string, corps?: unknown) => requete<T>(chemin, { methode: 'PUT', corps: corps ?? {} }),
  delete: <T>(chemin: string) => requete<T>(chemin, { methode: 'DELETE' }),
};
