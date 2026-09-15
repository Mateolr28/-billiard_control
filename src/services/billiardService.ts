import { db } from '../db';
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
  PaymentMethod,
  SessionMode,
  CustomerTab,
  CustomerTabItem,
  SlotMachine,
  SlotMachineMovement,
  SlotMovementType,
  SlotMachineStatus,
} from '../types';
import { calculateElapsedSeconds, calculateTimeCost, generateUUID, formatMoney } from '../utils/billing';
import { syncService } from './syncService';
import { soundService } from '../utils/sound';

export const billiardService = {
  /**
   * Start a standard game session or prepago on a free table
   */
  async startSession(tableId: string, mode: SessionMode = 'libre', prepagoMinutes?: number) {
    const table = await db.billiard_tables.get(tableId);
    if (!table) throw new Error('Mesa no encontrada');
    if (table.status !== 'libre') throw new Error('La mesa no está libre');

    const sessionId = generateUUID();
    const now = new Date().toISOString();

    const isConsumoOnly = mode === 'consumo';
    const newSession: TableSession = {
      id: sessionId,
      table_id: table.id,
      table_number: table.number,
      mode,
      prepago_minutes: mode === 'prepago' ? prepagoMinutes || 60 : null,
      started_at: now,
      paused_at: null,
      total_paused_seconds: 0,
      ended_at: null,
      hourly_rate: isConsumoOnly ? 0 : table.hourly_rate || 10000,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    const updatedTable: BilliardTable = {
      ...table,
      status: isConsumoOnly ? 'solo_consumo' : mode === 'prepago' ? 'prepago' : 'jugando',
      current_session_id: sessionId,
      updated_at: now,
    };

    await db.transaction('rw', [db.sessions, db.billiard_tables, db.audit_logs], async () => {
      await db.sessions.add(newSession);
      await db.billiard_tables.put(updatedTable);
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'START_SESSION',
        entity: 'session',
        details: `Partida iniciada en ${table.name} (Modo: ${mode}${mode === 'prepago' ? `, ${prepagoMinutes} min` : ''})`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('table_sessions', 'INSERT', newSession);
    await syncService.enqueueOperation('tables', 'UPDATE', updatedTable);

    return newSession;
  },

  /**
   * Pause an active session
   */
  async pauseSession(tableId: string) {
    const table = await db.billiard_tables.get(tableId);
    if (!table || !table.current_session_id) throw new Error('Sesión no encontrada');

    const session = await db.sessions.get(table.current_session_id);
    if (!session || session.status !== 'active') return;

    const now = new Date().toISOString();
    const updatedSession: TableSession = {
      ...session,
      status: 'paused',
      paused_at: now,
      updated_at: now,
    };

    const updatedTable: BilliardTable = {
      ...table,
      status: 'pausada',
      updated_at: now,
    };

    await db.transaction('rw', [db.sessions, db.billiard_tables, db.audit_logs], async () => {
      await db.sessions.put(updatedSession);
      await db.billiard_tables.put(updatedTable);
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'PAUSE_SESSION',
        entity: 'session',
        details: `Pausa registrada en ${table.name}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('table_sessions', 'UPDATE', updatedSession);
    await syncService.enqueueOperation('tables', 'UPDATE', updatedTable);
  },

  /**
   * Resume a paused session
   */
  async resumeSession(tableId: string) {
    const table = await db.billiard_tables.get(tableId);
    if (!table || !table.current_session_id) throw new Error('Sesión no encontrada');

    const session = await db.sessions.get(table.current_session_id);
    if (!session || session.status !== 'paused' || !session.paused_at) return;

    const now = new Date().toISOString();
    const pausedMs = new Date(now).getTime() - new Date(session.paused_at).getTime();
    const additionalPausedSeconds = Math.max(0, Math.floor(pausedMs / 1000));

    const updatedSession: TableSession = {
      ...session,
      status: 'active',
      paused_at: null,
      total_paused_seconds: (session.total_paused_seconds || 0) + additionalPausedSeconds,
      updated_at: now,
    };

    const updatedTable: BilliardTable = {
      ...table,
      status: session.mode === 'prepago' ? 'prepago' : 'jugando',
      updated_at: now,
    };

    await db.transaction('rw', [db.sessions, db.billiard_tables, db.audit_logs], async () => {
      await db.sessions.put(updatedSession);
      await db.billiard_tables.put(updatedTable);
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'RESUME_SESSION',
        entity: 'session',
        details: `Reanudación registrada en ${table.name}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('table_sessions', 'UPDATE', updatedSession);
    await syncService.enqueueOperation('tables', 'UPDATE', updatedTable);
  },

  /**
   * Fast 1-tap consumption increment
   */
  async addProductToSession(sessionId: string, tableId: string, productId: string) {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Producto no encontrado');

    const settings = await db.settings.get('default_config');
    if (!settings?.allow_negative_stock && product.stock <= 0) {
      throw new Error(`¡${product.name} está agotado! No hay unidades en stock.`);
    }

    const now = new Date().toISOString();
    const existing = await db.session_items
      .where('session_id')
      .equals(sessionId)
      .and((item) => item.product_id === productId)
      .first();

    if (existing) {
      const updatedItem: SessionItem = {
        ...existing,
        quantity: existing.quantity + 1,
        total_price: (existing.quantity + 1) * existing.unit_price,
      };

      await db.session_items.put(updatedItem);
      await syncService.enqueueOperation('session_items', 'UPDATE', updatedItem);
    } else {
      const newItem: SessionItem = {
        id: generateUUID(),
        session_id: sessionId,
        table_id: tableId,
        product_id: product.id,
        product_name: product.name,
        product_icon: product.icon,
        quantity: 1,
        unit_price: product.price,
        total_price: product.price,
        created_at: now,
      };

      await db.session_items.add(newItem);
      await syncService.enqueueOperation('session_items', 'INSERT', newItem);
    }

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'ADD_CONSUMPTION',
      entity: 'session_item',
      details: `+1 ${product.name} agregada a sesión`,
      timestamp: now,
    });
  },

  /**
   * Adjust consumption quantity or remove
   */
  async updateSessionItemQuantity(itemId: string, newQuantity: number) {
    if (newQuantity <= 0) {
      const item = await db.session_items.get(itemId);
      if (item) {
        await db.session_items.delete(itemId);
        await syncService.enqueueOperation('session_items', 'DELETE', { id: itemId });
      }
    } else {
      const item = await db.session_items.get(itemId);
      if (item) {
        const updatedItem: SessionItem = {
          ...item,
          quantity: newQuantity,
          total_price: newQuantity * item.unit_price,
        };
        await db.session_items.put(updatedItem);
        await syncService.enqueueOperation('session_items', 'UPDATE', updatedItem);
      }
    }
  },

  /**
   * Finalize and charge session (Venta cobrada)
   * Transactional: records sale, sale items, deducts inventory, closes session, frees table
   */
  async checkoutSession(
    sessionId: string,
    paymentMethod: PaymentMethod = 'efectivo',
    notes?: string
  ): Promise<Sale> {
    const session = await db.sessions.get(sessionId);
    if (!session) throw new Error('Sesión no encontrada');

    const table = await db.billiard_tables.get(session.table_id);
    if (!table) throw new Error('Mesa no encontrada');

    const items = await db.session_items.where('session_id').equals(sessionId).toArray();
    const now = new Date().toISOString();

    const elapsedSeconds = calculateElapsedSeconds(session, Date.now());
    const timeAmount = calculateTimeCost(elapsedSeconds, session.hourly_rate);
    const itemsAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);
    const totalAmount = timeAmount + itemsAmount;

    const saleId = generateUUID();
    const newSale: Sale = {
      id: saleId,
      session_id: sessionId,
      table_number: table.number,
      time_amount: timeAmount,
      items_amount: itemsAmount,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      time_played_seconds: elapsedSeconds,
      created_at: now,
    };

    const saleItems: SaleItem[] = items.map((it) => ({
      id: generateUUID(),
      sale_id: saleId,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.total_price,
      created_at: now,
    }));

    const updatedSession: TableSession = {
      ...session,
      status: 'ended',
      ended_at: now,
      notes: notes || session.notes,
      updated_at: now,
    };

    const updatedTable: BilliardTable = {
      ...table,
      status: 'libre',
      current_session_id: null,
      updated_at: now,
    };

    // Execute atomic transaction in IndexedDB
    await db.transaction('rw', [db.sales, db.sale_items, db.products, db.sessions, db.billiard_tables, db.audit_logs], async () => {
      // 1. Record sale
      await db.sales.add(newSale);

      // 2. Record sale items
      if (saleItems.length > 0) {
        await db.sale_items.bulkAdd(saleItems);
      }

      // 3. Deduct product inventory
      for (const it of items) {
        const prod = await db.products.get(it.product_id);
        if (prod) {
          await db.products.update(prod.id, {
            stock: Math.max(0, prod.stock - it.quantity),
            updated_at: now,
          });
        }
      }

      // 4. Update session
      await db.sessions.put(updatedSession);

      // 5. Free table
      await db.billiard_tables.put(updatedTable);

      // 6. Audit log
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'SALE_COMPLETED',
        entity: 'sale',
        details: `Venta cobrada en ${table.name} por ${totalAmount} (${paymentMethod})`,
        timestamp: now,
      });
    });

    // Enqueue sync operations
    await syncService.enqueueOperation('sales', 'INSERT', newSale);
    for (const si of saleItems) {
      await syncService.enqueueOperation('sale_items', 'INSERT', si);
    }
    for (const it of items) {
      const prod = await db.products.get(it.product_id);
      if (prod) {
        await syncService.enqueueOperation('products', 'UPDATE', prod);
      }
    }
    await syncService.enqueueOperation('table_sessions', 'UPDATE', updatedSession);
    await syncService.enqueueOperation('tables', 'UPDATE', updatedTable);

    soundService.playCashPing();
    return newSale;
  },

  /**
   * Finalize and charge to credit (FIAR)
   * Transactional: records debt, updates customer balance, deducts inventory, closes session, frees table
   */
  async chargeToDebt(
    sessionId: string,
    customerId: string,
    notes?: string
  ): Promise<Debt> {
    const session = await db.sessions.get(sessionId);
    if (!session) throw new Error('Sesión no encontrada');

    const table = await db.billiard_tables.get(session.table_id);
    if (!table) throw new Error('Mesa no encontrada');

    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Cliente no encontrado');

    const items = await db.session_items.where('session_id').equals(sessionId).toArray();
    const now = new Date().toISOString();

    const elapsedSeconds = calculateElapsedSeconds(session, Date.now());
    const timeAmount = calculateTimeCost(elapsedSeconds, session.hourly_rate);
    const itemsAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);
    const totalAmount = timeAmount + itemsAmount;

    const itemsSummary = items.map((it) => `${it.product_name} x${it.quantity}`).join(', ') || 'Sin consumos';

    const debtId = generateUUID();
    const newDebt: Debt = {
      id: debtId,
      customer_id: customer.id,
      customer_name: customer.name,
      session_id: sessionId,
      table_number: table.number,
      amount: totalAmount,
      time_amount: timeAmount,
      items_amount: itemsAmount,
      items_summary: itemsSummary,
      played_time_seconds: elapsedSeconds,
      notes: notes || '',
      created_at: now,
      is_settled: false,
      remaining_amount: totalAmount,
    };

    const updatedCustomer: Customer = {
      ...customer,
      current_debt: (customer.current_debt || 0) + totalAmount,
      updated_at: now,
    };

    const updatedSession: TableSession = {
      ...session,
      status: 'ended',
      ended_at: now,
      customer_name: customer.name,
      notes: `Fiado a ${customer.name}. ${notes || ''}`,
      updated_at: now,
    };

    const updatedTable: BilliardTable = {
      ...table,
      status: 'libre',
      current_session_id: null,
      updated_at: now,
    };

    await db.transaction('rw', [db.debts, db.customers, db.products, db.sessions, db.billiard_tables, db.audit_logs], async () => {
      // 1. Record debt
      await db.debts.add(newDebt);

      // 2. Update customer balance
      await db.customers.put(updatedCustomer);

      // 3. Deduct inventory
      for (const it of items) {
        const prod = await db.products.get(it.product_id);
        if (prod) {
          await db.products.update(prod.id, {
            stock: Math.max(0, prod.stock - it.quantity),
            updated_at: now,
          });
        }
      }

      // 4. Update session
      await db.sessions.put(updatedSession);

      // 5. Free table
      await db.billiard_tables.put(updatedTable);

      // 6. Audit
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'DEBT_RECORDED',
        entity: 'debt',
        details: `Fiado registrado para ${customer.name}: ${totalAmount} (${table.name})`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('debts', 'INSERT', newDebt);
    await syncService.enqueueOperation('customers', 'UPDATE', updatedCustomer);
    for (const it of items) {
      const prod = await db.products.get(it.product_id);
      if (prod) {
        await syncService.enqueueOperation('products', 'UPDATE', prod);
      }
    }
    await syncService.enqueueOperation('table_sessions', 'UPDATE', updatedSession);
    await syncService.enqueueOperation('tables', 'UPDATE', updatedTable);

    return newDebt;
  },

  /**
   * Cancel an active session without charging (liberar mesa)
   */
  async cancelSession(sessionId: string, reason: string = 'Cancelada por el operador') {
    const session = await db.sessions.get(sessionId);
    if (!session) return;

    const table = await db.billiard_tables.get(session.table_id);
    const now = new Date().toISOString();

    const updatedSession: TableSession = {
      ...session,
      status: 'ended',
      ended_at: now,
      notes: `CANCELADA: ${reason}`,
      updated_at: now,
    };

    const updatedTable: BilliardTable = {
      ...table!,
      status: 'libre',
      current_session_id: null,
      updated_at: now,
    };

    await db.transaction('rw', [db.sessions, db.billiard_tables, db.session_items, db.audit_logs], async () => {
      await db.sessions.put(updatedSession);
      if (table) {
        await db.billiard_tables.put(updatedTable);
      }
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'CANCEL_SESSION',
        entity: 'session',
        details: `Partida en ${table?.name || 'Mesa'} cancelada sin cobro`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('table_sessions', 'UPDATE', updatedSession);
    if (table) {
      await syncService.enqueueOperation('tables', 'UPDATE', updatedTable);
    }
  },

  /**
   * Register partial or full debt payment (ABONO)
   */
  async registerDebtPayment(
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod = 'efectivo',
    notes?: string
  ): Promise<DebtPayment> {
    if (amount <= 0) throw new Error('El valor del abono debe ser mayor a cero');

    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Cliente no encontrado');

    if (amount > customer.current_debt) {
      throw new Error(`El abono ($${amount}) no puede superar la deuda actual ($${customer.current_debt})`);
    }

    const now = new Date().toISOString();
    const paymentId = generateUUID();

    const newPayment: DebtPayment = {
      id: paymentId,
      customer_id: customer.id,
      customer_name: customer.name,
      amount,
      payment_method: paymentMethod,
      notes: notes || '',
      created_at: now,
    };

    const updatedCustomer: Customer = {
      ...customer,
      current_debt: Math.max(0, customer.current_debt - amount),
      updated_at: now,
    };

    const customerDebts = await db.debts
      .where('customer_id')
      .equals(customerId)
      .and((debt) => !debt.is_settled && debt.remaining_amount > 0)
      .sortBy('created_at');

    let amountToApply = amount;
    const updatedDebts: Debt[] = [];
    for (const debt of customerDebts) {
      if (amountToApply <= 0) break;

      const appliedAmount = Math.min(amountToApply, debt.remaining_amount);
      const remainingAmount = Math.max(0, debt.remaining_amount - appliedAmount);
      updatedDebts.push({
        ...debt,
        remaining_amount: remainingAmount,
        is_settled: remainingAmount === 0,
      });
      amountToApply -= appliedAmount;
    }

    await db.transaction('rw', [db.debt_payments, db.debts, db.customers, db.audit_logs], async () => {
      await db.debt_payments.add(newPayment);
      for (const debt of updatedDebts) {
        await db.debts.put(debt);
      }
      await db.customers.put(updatedCustomer);
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'DEBT_PAYMENT',
        entity: 'debt_payment',
        details: `Abono de ${amount} recibido de ${customer.name} (${paymentMethod})`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('debt_payments', 'INSERT', newPayment);
    for (const debt of updatedDebts) {
      await syncService.enqueueOperation('debts', 'UPDATE', debt);
    }
    await syncService.enqueueOperation('customers', 'UPDATE', updatedCustomer);

    soundService.playCashPing();
    return newPayment;
  },

  /**
   * Create a customer for the credit ledger
   */
  async createCustomer(data: { name: string; phone?: string; notes?: string }): Promise<Customer> {
    const name = data.name.trim();
    if (!name) throw new Error('El nombre del cliente es obligatorio');

    const now = new Date().toISOString();
    const customer: Customer = {
      id: generateUUID(),
      name,
      phone: data.phone?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      current_debt: 0,
      created_at: now,
      updated_at: now,
    };

    await db.customers.add(customer);
    await syncService.enqueueOperation('customers', 'INSERT', customer);
    return customer;
  },

  /**
   * Update customer contact details without changing their financial balance
   */
  async updateCustomer(customerId: string, updates: Pick<Customer, 'name' | 'phone' | 'notes'>): Promise<Customer> {
    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Cliente no encontrado');

    const name = updates.name.trim();
    if (!name) throw new Error('El nombre del cliente es obligatorio');

    const updatedCustomer: Customer = {
      ...customer,
      name,
      phone: updates.phone?.trim() || undefined,
      notes: updates.notes?.trim() || undefined,
      updated_at: new Date().toISOString(),
    };

    await db.customers.put(updatedCustomer);
    await syncService.enqueueOperation('customers', 'UPDATE', updatedCustomer);
    await db.audit_logs.add({
      id: generateUUID(),
      action: 'UPDATE_CUSTOMER',
      entity: 'customer',
      details: `Cliente modificado: ${updatedCustomer.name}`,
      timestamp: updatedCustomer.updated_at,
    });

    return updatedCustomer;
  },

  /**
   * Delete a customer only when it has no financial history
   */
  async deleteCustomer(customerId: string): Promise<void> {
    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Cliente no encontrado');

    if ((customer.current_debt || 0) > 0) {
      throw new Error('Primero debes saldar la deuda del cliente');
    }

    const customerDebts = await db.debts.where('customer_id').equals(customerId).toArray();
    const customerPayments = await db.debt_payments.where('customer_id').equals(customerId).toArray();

    await db.transaction('rw', [db.customers, db.debts, db.debt_payments, db.audit_logs], async () => {
      await db.customers.delete(customerId);
      await db.debts.where('customer_id').equals(customerId).delete();
      await db.debt_payments.where('customer_id').equals(customerId).delete();
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'DELETE_CUSTOMER',
        entity: 'customer',
        details: `Cliente eliminado: ${customer.name} junto con su historial financiero`,
        timestamp: new Date().toISOString(),
      });
    });

    for (const debt of customerDebts) {
      await syncService.enqueueOperation('debts', 'DELETE', { id: debt.id });
    }
    for (const payment of customerPayments) {
      await syncService.enqueueOperation('debt_payments', 'DELETE', { id: payment.id });
    }
    await syncService.enqueueOperation('customers', 'DELETE', { id: customerId });
  },

  /**
   * Pocket cash movement: + Meter dinero / - Sacar dinero
   */
  async addCashMovement(type: 'ingreso' | 'egreso', amount: number, concept: string): Promise<CashMovement> {
    if (amount <= 0) throw new Error('El valor debe ser mayor a 0');
    if (!concept || concept.trim() === '') throw new Error('El concepto es obligatorio');

    const now = new Date().toISOString();
    const movement: CashMovement = {
      id: generateUUID(),
      type,
      amount,
      concept: concept.trim(),
      created_at: now,
    };

    await db.transaction('rw', [db.cash_movements, db.audit_logs], async () => {
      await db.cash_movements.add(movement);
      await db.audit_logs.add({
        id: generateUUID(),
        action: type === 'ingreso' ? 'CASH_IN' : 'CASH_OUT',
        entity: 'cash_movement',
        details: `${type === 'ingreso' ? '+ Entrada' : '- Salida'} de caja: $${amount} - ${concept}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('cash_movements', 'INSERT', movement);
    return movement;
  },

  /**
   * Perform daily closing (Cierre del día)
   */
  async performDailyClosing(
    countedCash: number,
    notes?: string,
    closedBy: string = 'Operador'
  ): Promise<DailyClosing> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Look for today's sales, cash movements, debt payments
    // Calculate start of day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const salesToday = await db.sales.where('created_at').aboveOrEqual(startIso).toArray();
    const debtPaymentsToday = await db.debt_payments.where('created_at').aboveOrEqual(startIso).toArray();
    const cashMovementsToday = await db.cash_movements.where('created_at').aboveOrEqual(startIso).toArray();
    const debtsToday = await db.debts.where('created_at').aboveOrEqual(startIso).toArray();

    const cashSales = salesToday
      .filter((s) => s.payment_method === 'efectivo')
      .reduce((acc, s) => acc + s.total_amount, 0);

    const otherSales = salesToday
      .filter((s) => s.payment_method !== 'efectivo')
      .reduce((acc, s) => acc + s.total_amount, 0);

    const cashDebtPayments = debtPaymentsToday
      .filter((p) => p.payment_method === 'efectivo')
      .reduce((acc, p) => acc + p.amount, 0);

    const cashInflow = cashMovementsToday
      .filter((m) => m.type === 'ingreso')
      .reduce((acc, m) => acc + m.amount, 0);

    const cashOutflow = cashMovementsToday
      .filter((m) => m.type === 'egreso')
      .reduce((acc, m) => acc + m.amount, 0);

    // Formula as explicitly requested:
    // EFECTIVO ESPERADO = VENTAS EN EFECTIVO + ABONOS EN EFECTIVO + INGRESOS DE CAJA - EGRESOS DE CAJA
    const expectedCash = cashSales + cashDebtPayments + cashInflow - cashOutflow;
    const difference = countedCash - expectedCash;

    const totalDebtsCreated = debtsToday.reduce((acc, d) => acc + d.amount, 0);
    const debtsCount = debtsToday.length;

    const closingId = generateUUID();
    const closing: DailyClosing = {
      id: closingId,
      date: today,
      cash_sales: cashSales,
      other_sales: otherSales,
      cash_debt_payments: cashDebtPayments,
      cash_inflow: cashInflow,
      cash_outflow: cashOutflow,
      expected_cash: expectedCash,
      counted_cash: countedCash,
      difference,
      total_debts_created: totalDebtsCreated,
      debts_count: debtsCount,
      notes: notes || '',
      closed_at: now,
      closed_by: closedBy,
    };

    await db.transaction('rw', [db.daily_closings, db.audit_logs], async () => {
      await db.daily_closings.add(closing);
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'DAILY_CLOSING',
        entity: 'daily_closing',
        details: `Cierre del día realizado: Esperado $${expectedCash}, Contado $${countedCash}, Diferencia $${difference}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('daily_closings', 'INSERT', closing);
    return closing;
  },

  /**
   * Create a new table
   */
  async createTable(number: number, name?: string, hourlyRate: number = 10000): Promise<BilliardTable> {
    const existing = await db.billiard_tables.where('number').equals(number).first();
    if (existing && existing.is_active) {
      throw new Error(`Ya existe una mesa activa con el número ${number}`);
    }

    const now = new Date().toISOString();
    const id = existing ? existing.id : generateUUID();
    const newTable: BilliardTable = {
      id,
      number,
      name: name?.trim() || `Mesa ${number}`,
      status: 'libre',
      hourly_rate: hourlyRate > 0 ? hourlyRate : 10000,
      current_session_id: null,
      is_active: true,
      updated_at: now,
    };

    await db.billiard_tables.put(newTable);
    await syncService.enqueueOperation('tables', 'INSERT', newTable);

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'CREATE_TABLE',
      entity: 'table',
      details: `Mesa ${newTable.name} (#${number}) creada`,
      timestamp: now,
    });

    return newTable;
  },

  /**
   * Remove/delete table
   */
  async deleteTable(tableId: string): Promise<void> {
    const table = await db.billiard_tables.get(tableId);
    if (!table) throw new Error('Mesa no encontrada');

    if (table.status !== 'libre' || table.current_session_id) {
      throw new Error('No se puede eliminar una mesa que tiene una partida o cuenta abierta. Primero finaliza la partida.');
    }

    const now = new Date().toISOString();
    await db.billiard_tables.delete(tableId);
    await syncService.enqueueOperation('tables', 'DELETE', { id: tableId });

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'DELETE_TABLE',
      entity: 'table',
      details: `Mesa ${table.name} (#${table.number}) eliminada`,
      timestamp: now,
    });
  },

  /**
   * Direct sale for counter/bar customers (customers not playing pool)
   */
  async directSale(
    items: { productId: string; quantity: number; unitPrice: number; name: string; icon?: string }[],
    paymentMethod: PaymentMethod = 'efectivo',
    customerName?: string,
    notes?: string
  ): Promise<Sale> {
    if (!items || items.length === 0) {
      throw new Error('Debe seleccionar al menos un producto para la venta');
    }

    const totalAmount = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const now = new Date().toISOString();
    const saleId = generateUUID();

    const newSale: Sale = {
      id: saleId,
      session_id: null,
      table_number: null,
      time_amount: 0,
      items_amount: totalAmount,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      time_played_seconds: 0,
      created_at: now,
    };

    const saleItems: SaleItem[] = items.map((it) => ({
      id: generateUUID(),
      sale_id: saleId,
      product_id: it.productId,
      product_name: it.name,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      total_price: it.quantity * it.unitPrice,
      created_at: now,
    }));

    await db.transaction('rw', [db.sales, db.sale_items, db.products, db.audit_logs], async () => {
      await db.sales.add(newSale);
      for (const si of saleItems) {
        await db.sale_items.add(si);
        const product = await db.products.get(si.product_id);
        if (product) {
          const newStock = product.stock - si.quantity;
          await db.products.update(si.product_id, {
            stock: newStock,
            updated_at: now,
          });
        }
      }

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'DIRECT_SALE',
        entity: 'sale',
        details: `Venta mostrador/sin mesa: $${totalAmount} (${paymentMethod}) - ${customerName || 'Cliente barra'}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('sales', 'INSERT', newSale);
    for (const si of saleItems) {
      await syncService.enqueueOperation('sale_items', 'INSERT', si);
    }

    soundService.playCashPing();
    return newSale;
  },

  /**
   * Direct sale to customer debt (Fiado en mostrador/sin mesa)
   */
  async directSaleToDebt(
    customerId: string,
    items: { productId: string; quantity: number; unitPrice: number; name: string; icon?: string }[],
    notes?: string
  ): Promise<Debt> {
    if (!items || items.length === 0) {
      throw new Error('Debe seleccionar al menos un producto para registrar el fiado');
    }

    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Cliente no encontrado');

    const totalAmount = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const now = new Date().toISOString();
    const debtId = generateUUID();

    const itemsSummary = items
      .map((it) => `${it.quantity}x ${it.name} (${formatMoney(it.unitPrice * it.quantity)})`)
      .join(', ');

    const newDebt: Debt = {
      id: debtId,
      customer_id: customer.id,
      customer_name: customer.name,
      session_id: undefined,
      table_number: undefined,
      amount: totalAmount,
      time_amount: 0,
      items_amount: totalAmount,
      items_summary: itemsSummary,
      played_time_seconds: 0,
      notes: notes || 'Consumo en barra / sin mesa',
      created_at: now,
      is_settled: false,
      remaining_amount: totalAmount,
    };

    const updatedCustomer: Customer = {
      ...customer,
      current_debt: customer.current_debt + totalAmount,
      updated_at: now,
    };

    await db.transaction('rw', [db.debts, db.customers, db.products, db.audit_logs], async () => {
      await db.debts.add(newDebt);
      for (const it of items) {
        const product = await db.products.get(it.productId);
        if (product) {
          await db.products.update(it.productId, {
            stock: product.stock - it.quantity,
            updated_at: now,
          });
        }
      }
      await db.customers.put(updatedCustomer);
      await db.audit_logs.add({
        id: generateUUID(),
        action: 'DIRECT_DEBT',
        entity: 'debt',
        details: `Fiado sin mesa a ${customer.name}: $${totalAmount}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('debts', 'INSERT', newDebt);
    await syncService.enqueueOperation('customers', 'UPDATE', updatedCustomer);

    soundService.playCashPing();
    return newDebt;
  },

  /**
   * Open an ongoing consumption tab for a customer (consumen y pagan al final)
   */
  async openCustomerTab(
    customerName: string,
    options?: { customerId?: string; phone?: string; location?: string; notes?: string }
  ): Promise<CustomerTab> {
    const trimmedName = customerName.trim();
    if (!trimmedName) throw new Error('Ingresa el nombre o alias del cliente');

    const now = new Date().toISOString();
    const newTab: CustomerTab = {
      id: generateUUID(),
      customer_name: trimmedName,
      customer_id: options?.customerId,
      phone: options?.phone?.trim(),
      location: options?.location?.trim() || 'Barra',
      notes: options?.notes?.trim(),
      status: 'abierta',
      total_amount: 0,
      created_at: now,
      closed_at: null,
      payment_method: null,
    };

    await db.customer_tabs.add(newTab);
    await syncService.enqueueOperation('customer_tabs', 'INSERT', newTab);

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'OPEN_CUSTOMER_TAB',
      entity: 'customer_tab',
      details: `Cuenta abierta para cliente ${trimmedName} (${newTab.location})`,
      timestamp: now,
    });

    return newTab;
  },

  /**
   * Add a product to a customer tab
   */
  async addProductToCustomerTab(tabId: string, productId: string, quantity = 1) {
    const tab = await db.customer_tabs.get(tabId);
    if (!tab) throw new Error('Cuenta de cliente no encontrada');
    if (tab.status !== 'abierta') throw new Error('Esta cuenta ya ha sido cerrada');

    const product = await db.products.get(productId);
    if (!product) throw new Error('Producto no encontrado');

    if (product.stock <= 0) {
      throw new Error(`¡Producto ${product.name} agotado en inventario!`);
    }

    const now = new Date().toISOString();
    const existing = await db.customer_tab_items
      .where('tab_id')
      .equals(tabId)
      .and((item) => item.product_id === productId)
      .first();

    if (existing) {
      const newQty = existing.quantity + quantity;
      const updatedItem: CustomerTabItem = {
        ...existing,
        quantity: newQty,
        total_price: newQty * existing.unit_price,
      };
      await db.customer_tab_items.put(updatedItem);
      await syncService.enqueueOperation('customer_tab_items', 'UPDATE', updatedItem);
    } else {
      const newItem: CustomerTabItem = {
        id: generateUUID(),
        tab_id: tabId,
        product_id: product.id,
        product_name: product.name,
        product_icon: product.icon,
        quantity: quantity,
        unit_price: product.price,
        total_price: product.price * quantity,
        created_at: now,
      };
      await db.customer_tab_items.add(newItem);
      await syncService.enqueueOperation('customer_tab_items', 'INSERT', newItem);
    }

    // Recalculate tab total
    const allItems = await db.customer_tab_items.where('tab_id').equals(tabId).toArray();
    const newTotal = allItems.reduce((acc, it) => acc + it.total_price, 0);
    await db.customer_tabs.update(tabId, { total_amount: newTotal });

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'ADD_TAB_CONSUMPTION',
      entity: 'customer_tab_item',
      details: `+${quantity} ${product.name} a la cuenta de ${tab.customer_name}`,
      timestamp: now,
    });
  },

  /**
   * Adjust quantity on customer tab item
   */
  async updateCustomerTabItemQuantity(itemId: string, newQuantity: number) {
    const item = await db.customer_tab_items.get(itemId);
    if (!item) return;

    const tabId = item.tab_id;

    if (newQuantity <= 0) {
      await db.customer_tab_items.delete(itemId);
      await syncService.enqueueOperation('customer_tab_items', 'DELETE', { id: itemId });
    } else {
      const updatedItem: CustomerTabItem = {
        ...item,
        quantity: newQuantity,
        total_price: newQuantity * item.unit_price,
      };
      await db.customer_tab_items.put(updatedItem);
      await syncService.enqueueOperation('customer_tab_items', 'UPDATE', updatedItem);
    }

    // Recalculate tab total
    const allItems = await db.customer_tab_items.where('tab_id').equals(tabId).toArray();
    const newTotal = allItems.reduce((acc, it) => acc + it.total_price, 0);
    await db.customer_tabs.update(tabId, { total_amount: newTotal });
  },

  /**
   * Checkout and finalize customer tab (Cobrar cuenta al final)
   */
  async checkoutCustomerTab(
    tabId: string,
    paymentMethod: PaymentMethod = 'efectivo',
    notes?: string
  ): Promise<Sale> {
    const tab = await db.customer_tabs.get(tabId);
    if (!tab) throw new Error('Cuenta no encontrada');
    if (tab.status !== 'abierta') throw new Error('Esta cuenta ya fue cobrada');

    const items = await db.customer_tab_items.where('tab_id').equals(tabId).toArray();
    if (items.length === 0) {
      throw new Error('No hay productos registrados en esta cuenta para cobrar');
    }

    const totalAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);
    const now = new Date().toISOString();
    const saleId = generateUUID();

    const newSale: Sale = {
      id: saleId,
      session_id: null,
      table_number: null,
      time_amount: 0,
      items_amount: totalAmount,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      time_played_seconds: 0,
      created_at: now,
    };

    await db.transaction('rw', [db.sales, db.sale_items, db.products, db.customer_tabs, db.audit_logs], async () => {
      await db.sales.add(newSale);

      for (const item of items) {
        const saleItem: SaleItem = {
          id: generateUUID(),
          sale_id: saleId,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          created_at: now,
        };
        await db.sale_items.add(saleItem);

        // Deduct inventory
        const prod = await db.products.get(item.product_id);
        if (prod) {
          await db.products.update(item.product_id, {
            stock: prod.stock - item.quantity,
            updated_at: now,
          });
        }
      }

      // Close tab
      await db.customer_tabs.update(tabId, {
        status: 'cerrada',
        closed_at: now,
        payment_method: paymentMethod,
        notes: notes ? `${tab.notes || ''} [Cobrado: ${notes}]`.trim() : tab.notes,
      });

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'CHECKOUT_CUSTOMER_TAB',
        entity: 'sale',
        details: `Cobro cuenta de ${tab.customer_name}: $${totalAmount} (${paymentMethod})`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('sales', 'INSERT', newSale);
    soundService.playCashPing();
    return newSale;
  },

  /**
   * Pass customer tab to debts (Fiado al salir)
   */
  async customerTabToDebt(tabId: string, customerId?: string, notes?: string): Promise<Debt> {
    const tab = await db.customer_tabs.get(tabId);
    if (!tab) throw new Error('Cuenta no encontrada');
    if (tab.status !== 'abierta') throw new Error('Esta cuenta ya fue cerrada');

    const items = await db.customer_tab_items.where('tab_id').equals(tabId).toArray();
    if (items.length === 0) {
      throw new Error('No hay consumos en la cuenta para fiar');
    }

    const totalAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);
    const now = new Date().toISOString();

    let targetCustomer: Customer | undefined;
    if (customerId) {
      targetCustomer = await db.customers.get(customerId);
    } else if (tab.customer_id) {
      targetCustomer = await db.customers.get(tab.customer_id);
    }

    if (!targetCustomer) {
      // Find or create customer
      const existing = await db.customers.where('name').equalsIgnoreCase(tab.customer_name).first();
      if (existing) {
        targetCustomer = existing;
      } else {
        const newCustId = generateUUID();
        targetCustomer = {
          id: newCustId,
          name: tab.customer_name,
          phone: tab.phone,
          notes: tab.notes,
          current_debt: 0,
          created_at: now,
          updated_at: now,
        };
        await db.customers.add(targetCustomer);
      }
    }

    const debtId = generateUUID();
    const itemsSummary = items
      .map((it) => `${it.quantity}x ${it.product_name} (${formatMoney(it.total_price)})`)
      .join(', ');

    const newDebt: Debt = {
      id: debtId,
      customer_id: targetCustomer.id,
      customer_name: targetCustomer.name,
      session_id: undefined,
      table_number: undefined,
      amount: totalAmount,
      time_amount: 0,
      items_amount: totalAmount,
      items_summary: `Consumo barra (${tab.location || 'General'}): ${itemsSummary}`,
      played_time_seconds: 0,
      notes: notes || tab.notes,
      created_at: now,
      is_settled: false,
      remaining_amount: totalAmount,
    };

    const updatedCustomer: Customer = {
      ...targetCustomer,
      current_debt: targetCustomer.current_debt + totalAmount,
      updated_at: now,
    };

    await db.transaction('rw', [db.debts, db.customers, db.products, db.customer_tabs, db.audit_logs], async () => {
      await db.debts.add(newDebt);
      await db.customers.put(updatedCustomer);

      // Deduct inventory
      for (const item of items) {
        const prod = await db.products.get(item.product_id);
        if (prod) {
          await db.products.update(item.product_id, {
            stock: prod.stock - item.quantity,
            updated_at: now,
          });
        }
      }

      // Close tab
      await db.customer_tabs.update(tabId, {
        status: 'cerrada',
        closed_at: now,
        notes: `Pasado a fiados para ${targetCustomer!.name}`,
      });

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'TAB_TO_DEBT',
        entity: 'debt',
        details: `Cuenta de ${tab.customer_name} pasada a fiados: $${totalAmount}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('debts', 'INSERT', newDebt);
    await syncService.enqueueOperation('customers', 'UPDATE', updatedCustomer);
    soundService.playCashPing();
    return newDebt;
  },

  /**
   * Delete or cancel a customer tab
   */
  async deleteCustomerTab(tabId: string) {
    await db.transaction('rw', [db.customer_tabs, db.customer_tab_items], async () => {
      await db.customer_tab_items.where('tab_id').equals(tabId).delete();
      await db.customer_tabs.delete(tabId);
    });
  },

  /**
   * Create a new product in inventory with price and stock
   */
  async createProduct(data: {
    name: string;
    price: number;
    stock: number;
    min_stock?: number;
    category?: string;
    icon?: string;
    cost?: number;
  }): Promise<Product> {
    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('El nombre del producto es obligatorio');
    if (isNaN(data.price) || data.price < 0) {
      throw new Error('El precio de venta debe ser un número válido mayor o igual a 0');
    }
    if (isNaN(data.stock) || data.stock < 0) {
      throw new Error('El stock inicial debe ser un número mayor o igual a 0');
    }

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: generateUUID(),
      name: trimmedName,
      price: data.price,
      cost: data.cost !== undefined ? Number(data.cost) : undefined,
      stock: Math.floor(data.stock),
      min_stock: data.min_stock !== undefined ? Math.floor(data.min_stock) : 5,
      category: data.category?.trim() || 'Bebidas',
      icon: data.icon?.trim() || '🍺',
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    await db.products.add(newProduct);
    await syncService.enqueueOperation('products', 'INSERT', newProduct);

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'CREATE_PRODUCT',
      entity: 'product',
      details: `Producto creado: ${newProduct.name} - Precio venta: $${newProduct.price} - Stock: ${newProduct.stock} unid.`,
      timestamp: now,
    });

    return newProduct;
  },

  /**
   * Update an existing product
   */
  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Producto no encontrado');

    const now = new Date().toISOString();
    const updatedProduct: Product = {
      ...product,
      ...updates,
      updated_at: now,
    };

    await db.products.put(updatedProduct);
    await syncService.enqueueOperation('products', 'UPDATE', updatedProduct);

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'UPDATE_PRODUCT',
      entity: 'product',
      details: `Producto modificado: ${updatedProduct.name} - Precio venta: $${updatedProduct.price} - Stock: ${updatedProduct.stock} unid.`,
      timestamp: now,
    });

    return updatedProduct;
  },

  /**
   * Adjust product stock (+ replenishment or - loss/adjustment)
   */
  async adjustProductStock(
    productId: string,
    quantityDelta: number,
    reason?: string
  ): Promise<Product> {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Producto no encontrado');

    const newStock = Math.max(0, product.stock + quantityDelta);
    const now = new Date().toISOString();

    const updatedProduct: Product = {
      ...product,
      stock: newStock,
      updated_at: now,
    };

    await db.products.put(updatedProduct);
    await syncService.enqueueOperation('products', 'UPDATE', updatedProduct);

    const sign = quantityDelta >= 0 ? `+${quantityDelta}` : `${quantityDelta}`;
    await db.audit_logs.add({
      id: generateUUID(),
      action: quantityDelta >= 0 ? 'RESTOCK_PRODUCT' : 'DISCOUNT_STOCK',
      entity: 'product',
      details: `Ajuste de stock en ${product.name}: ${sign} unid. (Nuevo stock: ${newStock}). ${reason || ''}`,
      timestamp: now,
    });

    return updatedProduct;
  },

  /**
   * Delete or deactivate a product
   */
  async deleteProduct(productId: string, softDelete = false): Promise<void> {
    const product = await db.products.get(productId);
    if (!product) return;

    const now = new Date().toISOString();

    if (softDelete) {
      await db.products.update(productId, { is_active: false, updated_at: now });
      const updated = await db.products.get(productId);
      if (updated) {
        await syncService.enqueueOperation('products', 'UPDATE', updated);
      }
    } else {
      await db.products.delete(productId);
      await syncService.enqueueOperation('products', 'DELETE', { id: productId });
    }

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'DELETE_PRODUCT',
      entity: 'product',
      details: `Producto ${softDelete ? 'desactivado' : 'eliminado'}: ${product.name}`,
      timestamp: now,
    });
  },

  /**
   * Create a new slot machine (maquinita tragamonedas)
   */
  async createSlotMachine(data: {
    name: string;
    code?: string;
    location?: string;
    coin_denomination?: number;
    initial_balance: number;
    notes?: string;
  }): Promise<SlotMachine> {
    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('El nombre de la maquinita es obligatorio');
    const initialBal = Math.max(0, Number(data.initial_balance) || 0);
    const now = new Date().toISOString();
    const machineId = generateUUID();

    const newMachine: SlotMachine = {
      id: machineId,
      name: trimmedName,
      code: data.code?.trim() || undefined,
      location: data.location?.trim() || undefined,
      coin_denomination: data.coin_denomination ? Number(data.coin_denomination) : undefined,
      initial_balance: initialBal,
      current_balance: initialBal,
      total_in: initialBal,
      total_paid_out: 0,
      status: 'activa',
      is_active: true,
      notes: data.notes?.trim() || undefined,
      created_at: now,
      updated_at: now,
    };

    await db.transaction('rw', [db.slot_machines, db.slot_machine_movements, db.audit_logs], async () => {
      await db.slot_machines.add(newMachine);

      if (initialBal > 0) {
        const movementId = generateUUID();
        const initialMovement: SlotMachineMovement = {
          id: movementId,
          machine_id: machineId,
          machine_name: trimmedName,
          type: 'fondo_inicial',
          amount: initialBal,
          previous_balance: 0,
          new_balance: initialBal,
          notes: 'Fondo inicial cargado a la máquina para dar cambio/premios',
          created_at: now,
        };
        await db.slot_machine_movements.add(initialMovement);
      }

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'CREATE_SLOT_MACHINE',
        entity: 'slot_machine',
        details: `Maquinita registrada: ${newMachine.name} (Fondo inicial: $${initialBal})`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('slot_machines', 'INSERT', newMachine);
    return newMachine;
  },

  /**
   * Update slot machine details
   */
  async updateSlotMachine(machineId: string, updates: Partial<SlotMachine>): Promise<SlotMachine> {
    const machine = await db.slot_machines.get(machineId);
    if (!machine) throw new Error('Máquina no encontrada');

    const now = new Date().toISOString();
    const updated: SlotMachine = {
      ...machine,
      ...updates,
      updated_at: now,
    };

    await db.slot_machines.put(updated);
    await syncService.enqueueOperation('slot_machines', 'UPDATE', updated);

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'UPDATE_SLOT_MACHINE',
      entity: 'slot_machine',
      details: `Maquinita actualizada: ${updated.name} (Estado: ${updated.status})`,
      timestamp: now,
    });

    return updated;
  },

  /**
   * Delete or remove slot machine
   */
  async deleteSlotMachine(machineId: string, softDelete = false): Promise<void> {
    const machine = await db.slot_machines.get(machineId);
    if (!machine) return;
    const now = new Date().toISOString();

    if (softDelete) {
      await db.slot_machines.update(machineId, { is_active: false, status: 'inactiva', updated_at: now });
      const updated = await db.slot_machines.get(machineId);
      if (updated) {
        await syncService.enqueueOperation('slot_machines', 'UPDATE', updated);
      }
    } else {
      await db.transaction('rw', [db.slot_machines, db.slot_machine_movements], async () => {
        await db.slot_machine_movements.where('machine_id').equals(machineId).delete();
        await db.slot_machines.delete(machineId);
      });
      await syncService.enqueueOperation('slot_machines', 'DELETE', { id: machineId });
    }

    await db.audit_logs.add({
      id: generateUUID(),
      action: 'DELETE_SLOT_MACHINE',
      entity: 'slot_machine',
      details: `Maquinita eliminada: ${machine.name}`,
      timestamp: now,
    });
  },

  /**
   * Record a payout to a player (dinero que le han sacado los jugadores)
   */
  async recordSlotPayout(params: {
    machineId: string;
    amount: number;
    playerName?: string;
    notes?: string;
    deductFromMachineBalance?: boolean;
    payFromGeneralCash?: boolean;
  }): Promise<SlotMachineMovement> {
    const { machineId, amount, playerName, notes, deductFromMachineBalance = true, payFromGeneralCash = false } = params;

    if (isNaN(amount) || amount <= 0) {
      throw new Error('El monto del premio o dinero sacado debe ser mayor a 0');
    }

    const machine = await db.slot_machines.get(machineId);
    if (!machine) throw new Error('Máquina no encontrada');

    const now = new Date().toISOString();
    const prevBalance = machine.current_balance;
    const newBalance = deductFromMachineBalance ? Math.max(0, prevBalance - amount) : prevBalance;

    const movementId = generateUUID();
    const movement: SlotMachineMovement = {
      id: movementId,
      machine_id: machine.id,
      machine_name: machine.name,
      type: 'premio_jugador',
      amount,
      previous_balance: prevBalance,
      new_balance: newBalance,
      player_name: playerName?.trim() || undefined,
      notes: notes?.trim() || (playerName ? `Premio entregado a ${playerName}` : 'Dinero ganado por jugador'),
      sent_to_cash: payFromGeneralCash,
      created_at: now,
    };

    const updatedMachine: SlotMachine = {
      ...machine,
      current_balance: newBalance,
      total_paid_out: machine.total_paid_out + amount,
      updated_at: now,
    };

    await db.transaction('rw', [db.slot_machines, db.slot_machine_movements, db.cash_movements, db.audit_logs], async () => {
      await db.slot_machines.put(updatedMachine);
      await db.slot_machine_movements.add(movement);

      // If money was paid directly from general cash register, record an egreso in cash
      if (payFromGeneralCash) {
        await db.cash_movements.add({
          id: generateUUID(),
          type: 'egreso',
          amount,
          concept: `Premio pagado maquinita ${machine.name}${playerName ? ` a ${playerName}` : ''}`,
          created_at: now,
        });
      }

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'SLOT_PAYOUT',
        entity: 'slot_machine',
        details: `Premio sacado de ${machine.name}: $${amount}${playerName ? ` (Jugador: ${playerName})` : ''}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('slot_machines', 'UPDATE', updatedMachine);
    soundService.playCashPing();
    return movement;
  },

  /**
   * Record coins/cash inserted by players (Recaudación de jugadas)
   */
  async recordSlotIncome(params: {
    machineId: string;
    amount: number;
    notes?: string;
  }): Promise<SlotMachineMovement> {
    const { machineId, amount, notes } = params;

    if (isNaN(amount) || amount <= 0) {
      throw new Error('El monto de ingresos debe ser mayor a 0');
    }

    const machine = await db.slot_machines.get(machineId);
    if (!machine) throw new Error('Máquina no encontrada');

    const now = new Date().toISOString();
    const prevBalance = machine.current_balance;
    const newBalance = prevBalance + amount;

    const movementId = generateUUID();
    const movement: SlotMachineMovement = {
      id: movementId,
      machine_id: machine.id,
      machine_name: machine.name,
      type: 'ingreso_jugadas',
      amount,
      previous_balance: prevBalance,
      new_balance: newBalance,
      notes: notes?.trim() || 'Recaudación de jugadas / Monedas ingresadas',
      created_at: now,
    };

    const updatedMachine: SlotMachine = {
      ...machine,
      current_balance: newBalance,
      total_in: machine.total_in + amount,
      updated_at: now,
    };

    await db.transaction('rw', [db.slot_machines, db.slot_machine_movements, db.audit_logs], async () => {
      await db.slot_machines.put(updatedMachine);
      await db.slot_machine_movements.add(movement);

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'SLOT_INCOME',
        entity: 'slot_machine',
        details: `Ingreso registrado en ${machine.name}: +$${amount}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('slot_machines', 'UPDATE', updatedMachine);
    soundService.playCashPing();
    return movement;
  },

  /**
   * Adjust or reload balance (para agregar cuánto dinero tenía físicamente la máquina)
   */
  async adjustSlotBalance(params: {
    machineId: string;
    amount: number; // Nuevo saldo físico o monto a recargar
    mode: 'set_total' | 'reload_fund'; // 'set_total' = cuánto dinero tiene exactamente; 'reload_fund' = recarga sumada
    notes?: string;
  }): Promise<SlotMachineMovement> {
    const { machineId, amount, mode, notes } = params;

    if (isNaN(amount) || amount < 0) {
      throw new Error('El monto debe ser un número válido mayor o igual a 0');
    }

    const machine = await db.slot_machines.get(machineId);
    if (!machine) throw new Error('Máquina no encontrada');

    const now = new Date().toISOString();
    const prevBalance = machine.current_balance;

    let newBalance: number;
    let type: SlotMovementType;
    let movementAmount: number;

    if (mode === 'reload_fund') {
      newBalance = prevBalance + amount;
      type = 'recarga_fondo';
      movementAmount = amount;
    } else {
      newBalance = amount;
      type = 'ajuste_arqueo';
      movementAmount = Math.abs(amount - prevBalance);
    }

    const movementId = generateUUID();
    const movement: SlotMachineMovement = {
      id: movementId,
      machine_id: machine.id,
      machine_name: machine.name,
      type,
      amount: movementAmount,
      previous_balance: prevBalance,
      new_balance: newBalance,
      notes: notes?.trim() || (mode === 'reload_fund' ? 'Recarga de fondo para vuelto/premios' : `Arqueo físico de dinero en máquina ($${newBalance})`),
      created_at: now,
    };

    const updatedMachine: SlotMachine = {
      ...machine,
      current_balance: newBalance,
      total_in: mode === 'reload_fund' ? machine.total_in + amount : machine.total_in,
      updated_at: now,
    };

    await db.transaction('rw', [db.slot_machines, db.slot_machine_movements, db.audit_logs], async () => {
      await db.slot_machines.put(updatedMachine);
      await db.slot_machine_movements.add(movement);

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'SLOT_BALANCE_ADJUST',
        entity: 'slot_machine',
        details: `Ajuste de saldo en ${machine.name}: antes $${prevBalance} -> ahora $${newBalance}`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('slot_machines', 'UPDATE', updatedMachine);
    soundService.playCashPing();
    return movement;
  },

  /**
   * Empty / Withdraw profit from machine (Corte de caja de la máquina)
   */
  async emptySlotProfit(params: {
    machineId: string;
    amount: number;
    sendToGeneralCash?: boolean;
    notes?: string;
  }): Promise<SlotMachineMovement> {
    const { machineId, amount, sendToGeneralCash = true, notes } = params;

    if (isNaN(amount) || amount <= 0) {
      throw new Error('El monto a retirar debe ser mayor a 0');
    }

    const machine = await db.slot_machines.get(machineId);
    if (!machine) throw new Error('Máquina no encontrada');

    if (amount > machine.current_balance) {
      throw new Error(`La máquina solo tiene $${machine.current_balance} en tolva`);
    }

    const now = new Date().toISOString();
    const prevBalance = machine.current_balance;
    const newBalance = prevBalance - amount;

    const movementId = generateUUID();
    const movement: SlotMachineMovement = {
      id: movementId,
      machine_id: machine.id,
      machine_name: machine.name,
      type: 'vaciado_ganancia',
      amount,
      previous_balance: prevBalance,
      new_balance: newBalance,
      sent_to_cash: sendToGeneralCash,
      notes: notes?.trim() || 'Vaciado de ganancias / Corte de recaudación',
      created_at: now,
    };

    const updatedMachine: SlotMachine = {
      ...machine,
      current_balance: newBalance,
      updated_at: now,
    };

    await db.transaction('rw', [db.slot_machines, db.slot_machine_movements, db.cash_movements, db.audit_logs], async () => {
      await db.slot_machines.put(updatedMachine);
      await db.slot_machine_movements.add(movement);

      if (sendToGeneralCash) {
        await db.cash_movements.add({
          id: generateUUID(),
          type: 'ingreso',
          amount,
          concept: `Vaciado ganancias maquinita ${machine.name}`,
          created_at: now,
        });
      }

      await db.audit_logs.add({
        id: generateUUID(),
        action: 'SLOT_EMPTY_PROFIT',
        entity: 'slot_machine',
        details: `Vaciado de $${amount} en ${machine.name} (Queda con $${newBalance} en tolva)`,
        timestamp: now,
      });
    });

    await syncService.enqueueOperation('slot_machines', 'UPDATE', updatedMachine);
    soundService.playCashPing();
    return movement;
  },

  /**
   * Reset / Reload demo data (clean state for testing)
   */
  async reloadDemoData() {
    await db.billiard_tables.clear();
    await db.sessions.clear();
    await db.session_items.clear();
    await db.products.clear();
    await db.customers.clear();
    await db.debts.clear();
    await db.debt_payments.clear();
    await db.sales.clear();
    await db.sale_items.clear();
    await db.cash_movements.clear();
    await db.daily_closings.clear();
    await db.sync_queue.clear();
    await db.audit_logs.clear();
    await db.settings.clear();
    await db.customer_tabs.clear();
    await db.customer_tab_items.clear();
    await db.slot_machines.clear();
    await db.slot_machine_movements.clear();

    const { seedInitialData } = await import('../db');
    await seedInitialData();
  },
};
