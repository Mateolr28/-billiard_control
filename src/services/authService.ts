import { SupabaseClient, User } from '@supabase/supabase-js';
import { syncService } from './syncService';

export type AppRole = 'admin' | 'operador';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
}

export interface AuthSession {
  user: User;
  profile: UserProfile;
}

async function loadProfile(client: SupabaseClient, user: User): Promise<UserProfile> {
  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .single();

  if (error) {
    throw new Error('No fue posible cargar el perfil de usuario. Ejecuta el SQL de autenticación en Supabase.');
  }

  if (!data.is_active) {
    await client.auth.signOut();
    throw new Error('Esta cuenta está desactivada.');
  }

  return data as UserProfile;
}

export const authService = {
  async getSession(): Promise<AuthSession | null> {
    const client = syncService.getClient();
    if (!client) return null;

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return null;

    return { user: data.session.user, profile: await loadProfile(client, data.session.user) };
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    const client = syncService.getClient();
    if (!client) throw new Error('Supabase no está configurado. Revisa la URL y la clave anónima.');

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message || 'Correo o contraseña incorrectos.');

    return { user: data.user, profile: await loadProfile(client, data.user) };
  },

  async signOut() {
    const client = syncService.getClient();
    if (client) await client.auth.signOut();
  },

  onAuthStateChange(callback: () => void) {
    const client = syncService.getClient();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange(() => callback());
    return () => data.subscription.unsubscribe();
  },

  async createUser(input: { email: string; password: string; fullName: string; role: AppRole }) {
    const client = syncService.getClient();
    if (!client) throw new Error('Supabase no está configurado.');

    const { data, error } = await client.functions.invoke('admin-users', {
      body: input,
    });
    if (error) throw new Error(error.message || 'No fue posible crear la cuenta.');
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async listUsers(): Promise<UserProfile[]> {
    const client = syncService.getClient();
    if (!client) throw new Error('Supabase no está configurado.');

    const { data, error } = await client.from('profiles').select('id, email, full_name, role, is_active').order('created_at');
    if (error) throw error;
    return (data || []) as UserProfile[];
  },

  async setUserActive(userId: string, isActive: boolean) {
    const client = syncService.getClient();
    if (!client) throw new Error('Supabase no está configurado.');

    const { data, error } = await client.functions.invoke('admin-users', {
      body: { action: 'set_active', userId, isActive },
    });
    if (error) throw new Error(error.message || 'No fue posible actualizar la cuenta.');
    if (data?.error) throw new Error(data.error);
  },
};