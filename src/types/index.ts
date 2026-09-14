export type TableStatus = 'libre' | 'jugando' | 'pausada' | 'prepago' | 'solo_consumo' | 'pendiente_pago' | 'fuera_servicio';

export type SessionMode = 'libre' | 'prepago' | 'consumo';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'otro';

export type UserRole = 'admin' | 'operador';

export type SyncStatus = 'synced' | 'pending' | 'error';

export interface BilliardTable {
  id: string; // UUID
  number: number;
  name: string;
  status: TableStatus;
  hourly_rate: number;
  current_session_id?: string | null;
  is_active: boolean | number;
  updated_at: string;
}

export type BillarTable = BilliardTable;

export interface TableSession {
  id: string; // UUID
  table_id: string;
  table_number: number;
  mode: SessionMode;
  prepago_minutes?: number | null;
  started_at: string; // ISO String
  paused_at?: string | null;
  total_paused_seconds: number;
  ended_at?: string | null;
  hourly_rate: number;
  status: 'active' | 'paused' | 'ended';
  customer_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionItem {
  id: string; // UUID
  session_id: string;
  table_id: string;
  product_id: string;
  product_name: string;
  product_icon?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Product {
  id: string; // UUID
  name: string;
  price: number; // Precio de venta al público
  cost?: number; // Precio de costo / compra opcional
  stock: number;
  min_stock: number;
  category: string;
  icon?: string;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string; // UUID
  name: string;
  phone?: string;
  notes?: string;
  current_debt: number; // Saldo deudor acumulado
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string; // UUID
  customer_id: string;
  customer_name: string;
  session_id?: string;
  table_number?: number;
  amount: number;
  time_amount: number;
  items_amount: number;
  items_summary: string;
  played_time_seconds: number;
  notes?: string;
  created_at: string;
  is_settled: boolean;
  remaining_amount: number;
}

export interface DebtPayment {
  id: string; // UUID
  customer_id: string;
  customer_name: string;
  debt_id?: string;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string;
  created_at: string;
}

export interface Sale {
  id: string; // UUID
  session_id?: string | null;
  table_number?: number | null;
  time_amount: number;
  items_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  time_played_seconds: number;
  created_at: string;
}

export interface SaleItem {
  id: string; // UUID
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface CashMovement {
  id: string; // UUID
  type: 'ingreso' | 'egreso';
  amount: number;
  concept: string;
  created_at: string;
}

export interface DailyClosing {
  id: string; // UUID
  date: string; // YYYY-MM-DD
  cash_sales: number;
  other_sales: number;
  cash_debt_payments: number;
  cash_inflow: number; // Ingresos de caja
  cash_outflow: number; // Egresos de caja
  expected_cash: number;
  counted_cash: number;
  difference: number;
  total_debts_created: number;
  debts_count: number;
  notes?: string;
  closed_at: string;
  closed_by?: string;
}

export interface SyncQueueItem {
  id: string; // UUID
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  timestamp: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retry_count: number;
  error_message?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  details: string;
  timestamp: string;
}

export interface AppSettings {
  id: string;
  establishment_name: string;
  default_hourly_rate: number;
  allow_negative_stock: boolean;
  supabase_url?: string;
  supabase_anon_key?: string;
  last_synced_at?: string;
}

export interface CustomerTab {
  id: string; // UUID
  customer_name: string;
  customer_id?: string; // ID if linked to db.customers
  phone?: string;
  location?: string; // e.g. "Barra", "Silla 4", "Terraza", "Salón"
  notes?: string;
  status: 'abierta' | 'cerrada';
  total_amount: number;
  created_at: string;
  closed_at?: string | null;
  payment_method?: PaymentMethod | null;
}

export interface CustomerTabItem {
  id: string; // UUID
  tab_id: string;
  product_id: string;
  product_name: string;
  product_icon?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export type SlotMachineStatus = 'activa' | 'mantenimiento' | 'inactiva';

export type SlotMovementType =
  | 'fondo_inicial'
  | 'recarga_fondo'
  | 'ingreso_jugadas'
  | 'premio_jugador'
  | 'vaciado_ganancia'
  | 'ajuste_arqueo';

export interface SlotMachine {
  id: string; // UUID
  name: string; // Ej: "Tragamonedas Frutas #1"
  code?: string; // Ej: "M-01"
  location?: string; // Ej: "Entrada", "Junto a Mesa 2"
  coin_denomination?: number; // Ej: 500, 1000
  initial_balance: number; // Fondo con el que inició
  current_balance: number; // Cuánto dinero tiene la máquina actualmente en tolva/caja
  total_in: number; // Total acumulado ingresado por jugadores/recaudación
  total_paid_out: number; // Total acumulado que le han sacado los jugadores (premios)
  status: SlotMachineStatus;
  is_active: boolean | number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SlotMachineMovement {
  id: string; // UUID
  machine_id: string;
  machine_name: string;
  type: SlotMovementType;
  amount: number;
  previous_balance: number;
  new_balance: number;
  player_name?: string; // Nombre de jugador si fue premio
  notes?: string;
  sent_to_cash?: boolean; // Si se registró en la caja general del negocio
  created_at: string;
}
