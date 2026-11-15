import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleEnum, StatutCompteEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../auth/services/supabase.service';

/**
 * Comptes administrateur initiaux.
 *
 * La base métier est un PostgreSQL local (docker compose) : elle ne contient
 * pas le schéma `auth` de Supabase, donc la migration SQL de seed ne peut pas
 * créer ces utilisateurs. On passe par l'API Admin de Supabase (service role)
 * puis on promeut le profil local. Amorçage idempotent et non bloquant.
 */
const SEED_ADMINS = [
  { email: 'malickadmin@gmail.com', nom: 'Malick' },
  { email: 'boubacaradmin@gmail.com', nom: 'Boubacar' },
  { email: 'ibrahimaadmin@gmail.com', nom: 'Ibrahima' },
  { email: 'mariamacireadmin@gmail.com', nom: 'Mariama Cire' },
  { email: 'seyniadmin@gmail.com', nom: 'Seyni' },
];
const SEED_PASSWORD = 'Admin12345';

@Injectable()
export class AdminAccountsSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminAccountsSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    // En arrière-plan : une panne Supabase ne doit pas empêcher l'API de démarrer.
    void this.seed();
  }

  private async seed(): Promise<void> {
    const enabled = (this.config.get<string>('SEED_ADMIN_ACCOUNTS') ?? 'true').toLowerCase() !== 'false';
    if (!enabled) return;
    if (!this.config.get<string>('supabase.url') || !this.config.get<string>('supabase.serviceRoleKey')) {
      this.logger.warn('Comptes administrateur non amorcés : configuration Supabase absente.');
      return;
    }

    for (const admin of SEED_ADMINS) {
      try {
        const user = await this.supabase.ensureConfirmedUser(admin.email, SEED_PASSWORD);
        await this.prisma.profiles.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            nom: admin.nom,
            role: RoleEnum.ADMINISTRATEUR,
            statut: StatutCompteEnum.ACTIF,
            langue: 'fr',
          },
          update: {
            role: RoleEnum.ADMINISTRATEUR,
            statut: StatutCompteEnum.ACTIF,
            langue: 'fr',
            deletedAt: null,
          },
        });
        this.logger.log(`Compte administrateur prêt : ${admin.email}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erreur inconnue';
        this.logger.error(`Impossible de préparer le compte ${admin.email} : ${message}`);
      }
    }
  }
}
