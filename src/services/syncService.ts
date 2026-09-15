import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import { SyncQueueItem, SyncStatus } from '../types';
import { generateUUID } from '../utils/billing';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
  isConfigured: boolean;
  lastSyncTime: string | null;
  errorMessage?: string;
}

class SyncService {
  private client: SupabaseClient | null = null;
  private supabaseUrl: string = '';
  private supabaseAnonKey: string = '';
  private syncInProgress = false;
  private listeners: ((state: SyncState) => void)[] = [];
  private state: SyncState = {
    status: 'synced',
    pendingCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isConfigured: false,
    lastSyncTime: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleConnectivityChange(true));
      window.addEventListener('offline', () => this.handleConnectivityChange(false));
    }
  }

  /**
   * Initialize or update Supabase connection credentials
   */
  async init(url?: string, anonKey?: string) {
    let supabaseUrl = url;
    let supabaseAnonKey = anonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      // Check database settings
      const settings = await db.settings.get('default_config');
      if (settings?.supabase_url && settings?.supabase_anon_key) {
        supabaseUrl = settings.supabase_url;
        supabaseAnonKey = settings.supabase_anon_key;
      } else {
        // Check environment variables
        const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
        if (envUrl && envKey) {
          supabaseUrl = envUrl;
          supabaseAnonKey = envKey;
        }
      }
    }

    if (supabaseUrl && supabaseAnonKey && supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '') {
      try {
        this.client = createClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        this.state.isConfigured = true;
      } catch (err: any) {
        this.state.isConfigured = false;
        this.state.errorMessage = err?.message || 'Error al configurar Supabase';
      }
    } else {
      this.client = null;
      this.state.isConfigured = false;
    }

    await this.updatePendingCount();
    this.notify();

    // Trigger sync if online and configured
    if (this.state.isConfigured && this.state.isOnline) {
      this.processSyncQueue().catch(() => {});
    }
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  private async handleConnectivityChange(online: boolean) {
    this.state.isOnline = online;
    if (!online) {
      this.state.status = this.state.pendingCount > 0 ? 'pending' : 'synced';
    } else {
      if (this.state.isConfigured) {
        await this.processSyncQueue();
      }
    }
    this.notify();
  }

  private async updatePendingCount() {
    const pending = await db.sync_queue
      .where('status')
      .equals('pending')
      .or('status')
      .equals('failed')
      .count();

    this.state.pendingCount = pending;
    if (pending > 0) {
      this.state.status = 'pending';
    } else {
      this.state.status = 'synced';
    }
  }

  /**
   * Enqueue an operation to the sync queue for offline-first persistence
   */
  async enqueueOperation(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, any>
  ) {
    const item: SyncQueueItem = {
      id: generateUUID(),
      table_name: tableName,
      operation,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
    };

    await db.sync_queue.add(item);
    await this.updatePendingCount();
    this.notify();

    // If online and configured, kick off synchronization immediately in background
    if (this.state.isOnline && this.state.isConfigured && !this.syncInProgress) {
      this.processSyncQueue().catch(() => {});
    }
  }

  /**
   * Process all pending operations in the sync queue
   */
  async processSyncQueue(): Promise<{ success: boolean; synced: number; error?: string }> {
    if (this.syncInProgress) {
      return { success: true, synced: 0 };
    }

    if (!this.state.isConfigured || !this.client) {
      await this.updatePendingCount();
      this.notify();
      return { success: true, synced: 0 };
    }

    if (!this.state.isOnline) {
      this.state.status = 'pending';
      this.notify();
      return { success: false, synced: 0, error: 'Sin conexión a Internet' };
    }

    this.syncInProgress = true;
    let syncedCount = 0;

    try {
      const pendingItems = await db.sync_queue
        .where('status')
        .anyOf(['pending', 'failed'])
        .sortBy('timestamp');

      const syncPriority: Record<string, number> = {
        customers: 10,
        products: 20,
        tables: 30,
        table_sessions: 40,
        customer_tabs: 45,
        debts: 50,
        debt_payments: 60,
        session_items: 70,
        customer_tab_items: 75,
        sales: 80,
        sale_items: 90,
      };

      pendingItems.sort(
        (first, second) =>
          (syncPriority[first.table_name] || 100) - (syncPriority[second.table_name] || 100) ||
          first.timestamp.localeCompare(second.timestamp)
      );

      for (const item of pendingItems) {
        try {
          let error: any = null;

          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            let tab: Record<string, any> | undefined;
            let customerId: string | undefined;

            if (item.table_name === 'customer_tabs') {
              tab = item.payload;
              customerId = tab.customer_id;
            } else if (item.table_name === 'customer_tab_items') {
              tab = await db.customer_tabs.get(item.payload.tab_id);
              if (!tab) {
                throw new Error(`Cuenta abierta local no encontrada: ${item.payload.tab_id}`);
              }
              customerId = tab.customer_id;
            } else if (item.table_name === 'debts' || item.table_name === 'debt_payments') {
              customerId = item.payload.customer_id;
            }

            if (customerId) {
              let customer = await db.customers.get(customerId);
              if (!customer) {
                const now = new Date().toISOString();
                customer = {
                  id: customerId,
                  name: item.payload.customer_name || tab?.customer_name || 'Cliente',
                  phone: tab?.phone,
                  notes: tab?.notes,
                  current_debt: item.table_name === 'debts' ? Number(item.payload.amount) || 0 : 0,
                  created_at: item.payload.created_at || now,
                  updated_at: now,
                };
                await db.customers.put(customer);
              }

              const { error: customerError } = await this.client
                .from('customers')
                .upsert(customer, { onConflict: 'id' });
              if (customerError) {
                throw customerError;
              }
            }

            if (item.table_name === 'customer_tab_items') {
              const { error: tabError } = await this.client
                .from('customer_tabs')
                .upsert(tab, { onConflict: 'id' });
              if (tabError) {
                throw tabError;
              }

              const product = await db.products.get(item.payload.product_id);
              if (!product) {
                throw new Error(`Producto local no encontrado: ${item.payload.product_id}`);
              }

              const { error: productError } = await this.client
                .from('products')
                .upsert(product, { onConflict: 'id' });
              if (productError) {
                throw productError;
              }
            }
          }

          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            const { error: upsertError } = await this.client
              .from(item.table_name)
              .upsert(item.payload, { onConflict: 'id' });
            error = upsertError;
          } else if (item.operation === 'DELETE') {
            const { error: deleteError } = await this.client
              .from(item.table_name)
              .delete()
              .eq('id', item.payload.id);
            error = deleteError;
          }

          if (error) {
            console.warn(`Sync failed for item ${item.id} in ${item.table_name}:`, error);
            await db.sync_queue.update(item.id, {
              status: 'failed',
              retry_count: (item.retry_count || 0) + 1,
              error_message: error.message || 'Error en servidor Supabase',
            });
            this.state.status = 'error';
            this.state.errorMessage = error.message;
          } else {
            await db.sync_queue.update(item.id, {
              status: 'synced',
            });
            syncedCount++;
          }
        } catch (itemErr: any) {
          await db.sync_queue.update(item.id, {
            status: 'failed',
            retry_count: (item.retry_count || 0) + 1,
            error_message: itemErr?.message || 'Error inesperado',
          });
          this.state.status = 'error';
          this.state.errorMessage = itemErr?.message;
        }
      }

      this.state.lastSyncTime = new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      await this.updatePendingCount();
      this.notify();
      return { success: true, synced: syncedCount };
    } catch (err: any) {
      this.state.status = 'error';
      this.state.errorMessage = err?.message || 'Error en proceso de sincronización';
      this.notify();
      return { success: false, synced: syncedCount, error: err?.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Update Supabase credentials and reconfigure client
   */
  updateCredentials(url: string, key: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('SUPABASE_URL', url);
      localStorage.setItem('SUPABASE_ANON_KEY', key);
    }
    this.supabaseUrl = url;
    this.supabaseAnonKey = key;
    if (url && key) {
      this.client = createClient(url, key);
      this.state.isConfigured = true;
    } else {
      this.client = null;
      this.state.isConfigured = false;
    }
    this.notify();
  }

  /**
   * Test current or provided Supabase connection
   */
  async testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
    return this.testConnection(this.supabaseUrl || '', this.supabaseAnonKey || '');
  }

  /**
   * Test Supabase connection
   */
  async testConnection(url: string, anonKey: string): Promise<{ ok: boolean; message: string }> {
    try {
      if (!url || !anonKey) {
        return { ok: false, message: 'URL o Clave anónima vacía' };
      }
      const testClient = createClient(url.trim(), anonKey.trim());
      // Test querying tables
      const { data, error } = await testClient.from('tables').select('id').limit(1);
      if (error) {
        if (error.code === '42P01') {
          return {
            ok: true,
            message: 'Conexión a Supabase exitosa, pero las tablas aún no han sido creadas. Ejecuta el script SQL en el Editor SQL de Supabase.',
          };
        }
        return { ok: false, message: `Error Supabase: ${error.message}` };
      }
      return { ok: true, message: '¡Conexión y acceso a tablas verificados correctamente!' };
    } catch (err: any) {
      return { ok: false, message: `Error de red o configuración: ${err?.message || err}` };
    }
  }

  getState(): SyncState {
    return this.state;
  }
}

export const syncService = new SyncService();
