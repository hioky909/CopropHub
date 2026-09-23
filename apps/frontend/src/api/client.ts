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

export const api = {
  get: <T>(chemin: string) => requete<T>(chemin),
  post: <T>(chemin: string, corps?: unknown) => requete<T>(chemin, { methode: 'POST', corps: corps ?? {} }),
  patch: <T>(chemin: string, corps?: unknown) => requete<T>(chemin, { methode: 'PATCH', corps: corps ?? {} }),
};
