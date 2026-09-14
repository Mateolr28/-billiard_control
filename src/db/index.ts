import Dexie, { Table } from 'dexie';
import {
  BilliardTable,
  TableSession,
  SessionItem,
  Product,
  Customer,
  Debt,
  DebtPayment,
  Sale,
  SaleItem,
  CashMovement,
  DailyClosing,
  SyncQueueItem,
  AuditLog,
  AppSettings,
  CustomerTab,
  CustomerTabItem,
  SlotMachine,
  SlotMachineMovement,
} from '../types';
import { generateUUID } from '../utils/billing';

export class BillarDatabase extends Dexie {
  billiard_tables!: Table<BilliardTable, string>;
  sessions!: Table<TableSession, string>;
  session_items!: Table<SessionItem, string>;
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  debts!: Table<Debt, string>;
  debt_payments!: Table<DebtPayment, string>;
  sales!: Table<Sale, string>;
  sale_items!: Table<SaleItem, string>;
  cash_movements!: Table<CashMovement, string>;
  daily_closings!: Table<DailyClosing, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  audit_logs!: Table<AuditLog, string>;
  settings!: Table<AppSettings, string>;
  customer_tabs!: Table<CustomerTab, string>;
  customer_tab_items!: Table<CustomerTabItem, string>;
  slot_machines!: Table<SlotMachine, string>;
  slot_machine_movements!: Table<SlotMachineMovement, string>;

  constructor() {
    super('billar_control_db');

    this.version(1).stores({
      billiard_tables: 'id, number, status, is_active, updated_at',
      sessions: 'id, table_id, status, started_at, ended_at, created_at',
      session_items: 'id, session_id, table_id, product_id, created_at',
      products: 'id, name, is_active, category, updated_at',
      customers: 'id, name, current_debt, updated_at',
      debts: 'id, customer_id, session_id, is_settled, created_at',
      debt_payments: 'id, customer_id, debt_id, created_at',
      sales: 'id, session_id, payment_method, created_at',
      sale_items: 'id, sale_id, product_id, created_at',
      cash_movements: 'id, type, created_at',
      daily_closings: 'id, date, closed_at',
      sync_queue: 'id, table_name, status, timestamp',
      audit_logs: 'id, timestamp, action',
      settings: 'id',
    });

    this.version(2).stores({
      customer_tabs: 'id, customer_name, status, created_at',
      customer_tab_items: 'id, tab_id, product_id, created_at',
    });

    this.version(3).stores({
      slot_machines: 'id, name, status, is_active, created_at',
      slot_machine_movements: 'id, machine_id, type, created_at',
    });
  }
}

export const db = new BillarDatabase();

/**
 * Seed initial billiard hall data if the database is newly initialized
 */
export async function seedInitialData() {
  const tableCount = await db.billiard_tables.count();
  if (tableCount === 0) {
    const defaultRate = 10000;
    const now = new Date().toISOString();

    // 6 Initial Tables
    const initialTables: BilliardTable[] = [1, 2, 3, 4, 5, 6].map((num) => ({
      id: generateUUID(),
      number: num,
      name: `Mesa ${num}`,
      status: 'libre',
      hourly_rate: defaultRate,
      current_session_id: null,
      is_active: true,
      updated_at: now,
    }));

    await db.billiard_tables.bulkAdd(initialTables);

    // Initial Products as requested
    const initialProducts: Product[] = [
      {
        id: generateUUID(),
        name: 'Cerveza',
        price: 4000,
        stock: 48,
        min_stock: 12,
        category: 'Bebidas',
        icon: '🍺',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: generateUUID(),
        name: 'Gaseosa',
        price: 3000,
        stock: 36,
        min_stock: 10,
        category: 'Bebidas',
        icon: '🥤',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: generateUUID(),
        name: 'Agua',
        price: 2000,
        stock: 30,
        min_stock: 6,
        category: 'Bebidas',
        icon: '💧',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: generateUUID(),
        name: 'Snack',
        price: 3000,
        stock: 24,
        min_stock: 5,
        category: 'Comestibles',
        icon: '🍟',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: generateUUID(),
        name: 'Dulces',
        price: 1000,
        stock: 60,
        min_stock: 15,
        category: 'Comestibles',
        icon: '🍬',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    await db.products.bulkAdd(initialProducts);

    // Initial Customers as requested
    const initialCustomers: Customer[] = [
      {
        id: generateUUID(),
        name: 'Carlos',
        phone: '300 123 4567',
        notes: 'Cliente habitual fines de semana',
        current_debt: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: generateUUID(),
        name: 'Juan',
        phone: '310 987 6543',
        notes: 'Amigo de Don Pedro',
        current_debt: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: generateUUID(),
        name: 'Pedro',
        phone: '320 555 7890',
        notes: 'Juega bola 8 los martes y jueves',
        current_debt: 0,
        created_at: now,
        updated_at: now,
      },
    ];

    await db.customers.bulkAdd(initialCustomers);

    // Initial Settings
    const initialSettings: AppSettings = {
      id: 'default_config',
      establishment_name: 'Billar El Trébol',
      default_hourly_rate: 10000,
      allow_negative_stock: false,
      supabase_url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
      supabase_anon_key: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
    };

    await db.settings.put(initialSettings);

    // Initial base cash movement for demo convenience
    const initialCashMovement: CashMovement = {
      id: generateUUID(),
      type: 'ingreso',
      amount: 50000,
      concept: 'Base inicial para vueltas en caja',
      created_at: now,
    };
    await db.cash_movements.add(initialCashMovement);

    // Initial Slot Machines (Tragamonedas)
    const slotCount = await db.slot_machines.count();
    if (slotCount === 0) {
      const machine1Id = generateUUID();
      const machine2Id = generateUUID();

      const sampleMachines: SlotMachine[] = [
        {
          id: machine1Id,
          name: 'Tragamonedas Frutas #1',
          code: 'TM-01',
          location: 'Entrada Principal',
          coin_denomination: 500,
          initial_balance: 100000,
          current_balance: 135000,
          total_in: 185000,
          total_paid_out: 50000,
          status: 'activa',
          is_active: true,
          notes: 'Máquina clásica de frutas. Denominación $500',
          created_at: now,
          updated_at: now,
        },
        {
          id: machine2Id,
          name: 'Poker Bonus Royal #2',
          code: 'TM-02',
          location: 'Junto a Barra',
          coin_denomination: 1000,
          initial_balance: 150000,
          current_balance: 210000,
          total_in: 280000,
          total_paid_out: 70000,
          status: 'activa',
          is_active: true,
          notes: 'Video poker con pagos directos. Denominación $1.000',
          created_at: now,
          updated_at: now,
        },
      ];
      await db.slot_machines.bulkAdd(sampleMachines);

      await db.slot_machine_movements.bulkAdd([
        {
          id: generateUUID(),
          machine_id: machine1Id,
          machine_name: 'Tragamonedas Frutas #1',
          type: 'fondo_inicial',
          amount: 100000,
          previous_balance: 0,
          new_balance: 100000,
          notes: 'Fondo inicial para dar premios y vueltos',
          created_at: now,
        },
        {
          id: generateUUID(),
          machine_id: machine1Id,
          machine_name: 'Tragamonedas Frutas #1',
          type: 'premio_jugador',
          amount: 50000,
          previous_balance: 185000,
          new_balance: 135000,
          player_name: 'Carlos',
          notes: 'Premio trío de cerezas sacado por el cliente',
          created_at: now,
        },
        {
          id: generateUUID(),
          machine_id: machine2Id,
          machine_name: 'Poker Bonus Royal #2',
          type: 'fondo_inicial',
          amount: 150000,
          previous_balance: 0,
          new_balance: 150000,
          notes: 'Fondo inicial cargado en tolva',
          created_at: now,
        },
      ]);
    }

    // Log initialization in audit
    await db.audit_logs.add({
      id: generateUUID(),
      action: 'INIT_SYSTEM',
      entity: 'system',
      details: 'Base de datos inicializada localmente con 6 mesas, productos y clientes demo.',
      timestamp: now,
    });
  }
}
