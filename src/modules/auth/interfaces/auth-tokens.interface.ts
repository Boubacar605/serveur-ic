import { RoleEnum, StatutCompteEnum } from '@prisma/client';

/**
 * Réponse d'authentification. Le rôle est renvoyé dès la connexion : le client
 * peut router vers le bon espace sans attendre un second appel à /auth/me.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string | null;
    nom?: string | null;
    role?: RoleEnum;
    statut?: StatutCompteEnum;
    isPremium?: boolean;
  };
}
