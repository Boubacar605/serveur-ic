import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthTokens } from '../interfaces/auth-tokens.interface';

@Injectable()
export class SupabaseService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Crée un compte public via signUp. `hasSession` vaut false quand Supabase
   * exige la confirmation de l'adresse e-mail : l'inscription renvoie alors
   * l'e-mail de confirmation et le client doit afficher « vérifiez vos e-mails ».
   */
  async createUser(email: string, password: string): Promise<{ user: User; hasSession: boolean }> {
    const { data, error } = await this.createAnonClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: this.frontendUrl('/verify-email') },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (error.code === 'email_exists' || error.code === 'user_already_exists' || message.includes('already registered')) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new BadRequestException(error.message);
    }
    if (!data.user) throw new ServiceUnavailableException('Supabase did not return the created user');
    if (data.user.identities?.length === 0) {
      throw new ConflictException('An account with this email already exists');
    }
    return { user: data.user, hasSession: Boolean(data.session) };
  }

  /** Création back-office : le compte est confirmé immédiatement, sans e-mail. */
  async createConfirmedUser(email: string, password: string): Promise<User> {
    const { data, error } = await this.createAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('already') || message.includes('exists')) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new BadRequestException(error.message);
    }
    if (!data.user) throw new ServiceUnavailableException('Supabase did not return the created user');
    return data.user;
  }

  async resendConfirmation(email: string): Promise<void> {
    const { error } = await this.createAnonClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: this.frontendUrl('/verify-email') },
    });
    if (error) throw new BadRequestException(error.message);
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.createAdminClient().auth.admin.deleteUser(userId);
    if (error) throw new ServiceUnavailableException('Could not roll back Supabase user creation');
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const { data, error } = await this.createAnonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.toAuthTokens(data.session, data.user);
  }

  async logout(accessToken: string): Promise<void> {
    const { error } = await this.createAdminClient().auth.admin.signOut(accessToken, 'local');
    if (error) throw new UnauthorizedException('Could not revoke the current session');
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { data, error } = await this.createAnonClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return this.toAuthTokens(data.session, data.user);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.createAnonClient().auth.resetPasswordForEmail(email, {
      redirectTo: this.frontendUrl('/reset-password'),
    });
    if (error) throw new BadRequestException(error.message);
  }

  /**
   * Deux formats de lien Supabase sont acceptés :
   *  - `token_hash` (lien « token hash » envoyé par e-mail) ;
   *  - `access_token` (fragment `#access_token=…&type=recovery` du lien par défaut).
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (this.looksLikeJwt(token)) {
      return this.resetPasswordWithAccessToken(token, newPassword);
    }
    const client = this.createAnonClient();
    const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: 'recovery' });
    if (error || !data.session) throw new BadRequestException('The password reset token is invalid or expired');

    const { error: updateError } = await client.auth.updateUser({ password: newPassword });
    if (updateError) throw new BadRequestException(updateError.message);
  }

  async resetPasswordWithAccessToken(accessToken: string, newPassword: string): Promise<void> {
    const admin = this.createAdminClient();
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data.user) throw new BadRequestException('The password reset token is invalid or expired');
    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, { password: newPassword });
    if (updateError) throw new BadRequestException(updateError.message);
  }

  async getCurrentUser(accessToken: string): Promise<User> {
    const { data, error } = await this.createAnonClient().auth.getUser(accessToken);
    if (error || !data.user) throw new UnauthorizedException('Invalid or expired access token');
    return data.user;
  }

  validateJwt(accessToken: string): Promise<User> {
    return this.getCurrentUser(accessToken);
  }

  async ensurePictureBucket(): Promise<void> {
    const bucket = this.pictureBucket();
    const admin = this.createAdminClient();
    const { data } = await admin.storage.getBucket(bucket);
    if (data) return;
    const { error } = await admin.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: '2MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !error.message.toLowerCase().includes('already exists')) {
      throw new ServiceUnavailableException(`Could not initialize the ${bucket} storage bucket`);
    }
  }

  async uploadProfilePicture(userId: string, objectPath: string, buffer: Buffer, contentType: string): Promise<string> {
    const bucket = this.pictureBucket();
    await this.ensurePictureBucket();
    const { error } = await this.createAdminClient().storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType, upsert: false });
    if (error) throw new ServiceUnavailableException('Could not upload the profile picture');
    const { data } = this.createAdminClient().storage.from(bucket).getPublicUrl(objectPath);
    if (!data.publicUrl) throw new ServiceUnavailableException('Could not resolve the profile picture URL');
    return data.publicUrl;
  }

  async deleteProfilePicture(objectPath: string): Promise<void> {
    const { error } = await this.createAdminClient().storage
      .from(this.pictureBucket())
      .remove([objectPath]);
    if (error) throw new ServiceUnavailableException('Could not delete the profile picture');
  }

  profilePicturePath(publicUrl: string): string | null {
    const marker = `/object/public/${this.pictureBucket()}/`;
    const index = publicUrl.indexOf(marker);
    return index === -1 ? null : decodeURIComponent(publicUrl.slice(index + marker.length));
  }

  private pictureBucket(): string {
    return this.configService.get<string>('supabase.pictureBucket') ?? 'pictureProfile';
  }

  /** FRONTEND_URL peut contenir plusieurs origines séparées par des virgules. */
  private frontendUrl(path: string): string {
    const configured = this.configService.get<string>('FRONTEND_URL') ?? '';
    const first = configured.split(',').map((value) => value.trim()).find(Boolean) ?? 'http://localhost:8081';
    return `${first.replace(/\/+$/, '')}${path}`;
  }

  private looksLikeJwt(value: string): boolean {
    return value.split('.').length === 3 && value.startsWith('eyJ');
  }

  private createAnonClient(): SupabaseClient {
    return createClient(
      this.requireConfig('supabase.url'),
      this.requireConfig('supabase.anonKey'),
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }

  private createAdminClient(): SupabaseClient {
    return createClient(
      this.requireConfig('supabase.url'),
      this.requireConfig('supabase.serviceRoleKey'),
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }

  private requireConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new ServiceUnavailableException(`${key} is not configured`);
    return value;
  }

  private toAuthTokens(session: Session, user: User): AuthTokens {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: { id: user.id, email: user.email ?? null },
    };
  }
}
