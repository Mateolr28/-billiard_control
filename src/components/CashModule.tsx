import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MinusCircle,
  Calculator,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Check,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../db';
import { CashMovement, DailyClosing } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';

export const CashModule: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'movements' | 'closing' | 'history'>('closing');

  // Query today's transactions
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  const salesToday = useLiveQuery(() => db.sales.where('created_at').aboveOrEqual(startIso).toArray(), []) || [];
  const debtPaymentsToday =
    useLiveQuery(() => db.debt_payments.where('created_at').aboveOrEqual(startIso).toArray(), []) || [];
  const cashMovementsToday =
    useLiveQuery(() => db.cash_movements.where('created_at').aboveOrEqual(startIso).toArray(), []) || [];
  const debtsToday = useLiveQuery(() => db.debts.where('created_at').aboveOrEqual(startIso).toArray(), []) || [];
  const closingHistory = useLiveQuery(() => db.daily_closings.reverse().toArray(), []) || [];

  // Movements Form
  const [showAddMovementModal, setShowAddMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('egreso');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementConcept, setMovementConcept] = useState('');
  const quickConcepts = ['Base inicial', 'Pago proveedor', 'Compra de hielo', 'Cambio', 'Gasto personal', 'Bebidas'];

  // Closing Form
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closedSuccess, setClosedSuccess] = useState<DailyClosing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Financial Calculations for Today
  const cashSales = salesToday
    .filter((s) => s.payment_method === 'efectivo')
    .reduce((acc, s) => acc + s.total_amount, 0);

  const otherSales = salesToday
    .filter((s) => s.payment_method !== 'efectivo')
    .reduce((acc, s) => acc + s.total_amount, 0);

  const totalTimePlayedAmount = salesToday.reduce((acc, s) => acc + s.time_amount, 0);
  const totalItemsSoldAmount = salesToday.reduce((acc, s) => acc + s.items_amount, 0);

  const cashDebtPayments = debtPaymentsToday
    .filter((p) => p.payment_method === 'efectivo')
    .reduce((acc, p) => acc + p.amount, 0);

  const otherDebtPayments = debtPaymentsToday
    .filter((p) => p.payment_method !== 'efectivo')
    .reduce((acc, p) => acc + p.amount, 0);

  const cashInflow = cashMovementsToday
    .filter((m) => m.type === 'ingreso')
    .reduce((acc, m) => acc + m.amount, 0);

  const cashOutflow = cashMovementsToday
    .filter((m) => m.type === 'egreso')
    .reduce((acc, m) => acc + m.amount, 0);

  // EFECTIVO ESPERADO = VENTAS EN EFECTIVO + ABONOS EN EFECTIVO + INGRESOS DE CAJA - EGRESOS DE CAJA
  const expectedCash = cashSales + cashDebtPayments + cashInflow - cashOutflow;

  const totalDebtsCreatedToday = debtsToday.reduce((acc, d) => acc + d.amount, 0);

  const countedCashNumber = parseFloat(countedCashInput) || 0;
  const cashDifference = countedCashNumber - expectedCash;

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(movementAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Ingresa un monto válido');
      return;
    }
    if (!movementConcept.trim()) {
      alert('Ingresa el concepto del movimiento');
      return;
    }

    try {
      await billiardService.addCashMovement(movementType, amountNum, movementConcept);
      setMovementAmount('');
      setMovementConcept('');
      setShowAddMovementModal(false);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar movimiento');
    }
  };

  const handlePerformClosing = async () => {
    if (!countedCashInput) {
      alert('Por favor ingresa el monto de efectivo que contaste físicamente.');
      return;
    }

    if (
      window.confirm(
        `¿Confirmas el cierre del día con $${countedCashNumber} contados? (Diferencia: ${
          cashDifference === 0 ? 'Exacto ($0)' : formatMoney(cashDifference)
        })`
      )
    ) {
      setIsSubmitting(true);
      try {
        const closing = await billiardService.performDailyClosing(
          countedCashNumber,
          closingNotes,
          'Operador'
        );
        setClosedSuccess(closing);
        setCountedCashInput('');
        setClosingNotes('');
      } catch (err: any) {
        alert(err?.message || 'Error al realizar cierre');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-[#1E293B] rounded-2xl border border-[#334155] w-fit">
        <button
          onClick={() => setActiveSubTab('closing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'closing'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Cuadre del Día</span>
        </button>

        <button
          onClick={() => setActiveSubTab('movements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'movements'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Caja de Bolsillo (+ / -)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Historial de Cierres</span>
        </button>
      </div>

      {/* 1. CUADRE DEL DÍA */}
      {activeSubTab === 'closing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Formula Card */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#273449] border border-[#334155] shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
                <div>
                  <h3 className="text-lg font-black text-[#F8FAFC] flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[#10B981]" />
                    <span>Cálculo de Efectivo Esperado en Caja</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Suma y resta en tiempo real del turno actual
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[#94A3B8]">Total Esperado</span>
                  <div className="text-2xl font-black text-[#10B981] font-timer">
                    {formatMoney(expectedCash)}
                  </div>
                </div>
              </div>

              {/* Mathematical formula breakdown as requested */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <div className="flex items-center gap-2 text-[#F8FAFC]">
                    <span className="w-6 h-6 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold flex items-center justify-center text-xs">
                      +
                    </span>
                    <span>Ventas cobradas en efectivo ({salesToday.filter(s => s.payment_method === 'efectivo').length})</span>
                  </div>
                  <span className="font-bold text-[#F8FAFC] font-timer">{formatMoney(cashSales)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <div className="flex items-center gap-2 text-[#F8FAFC]">
                    <span className="w-6 h-6 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold flex items-center justify-center text-xs">
                      +
                    </span>
                    <span>Abonos recibidos en efectivo ({debtPaymentsToday.filter(p => p.payment_method === 'efectivo').length})</span>
                  </div>
                  <span className="font-bold text-[#F8FAFC] font-timer">{formatMoney(cashDebtPayments)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <div className="flex items-center gap-2 text-[#F8FAFC]">
                    <span className="w-6 h-6 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold flex items-center justify-center text-xs">
                      +
                    </span>
                    <span>Ingresos de caja (base, meter dinero)</span>
                  </div>
                  <span className="font-bold text-[#F8FAFC] font-timer">{formatMoney(cashInflow)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <div className="flex items-center gap-2 text-[#F8FAFC]">
                    <span className="w-6 h-6 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 font-bold flex items-center justify-center text-xs">
                      -
                    </span>
                    <span>Egresos de caja (sacar dinero, pagos, compras)</span>
                  </div>
                  <span className="font-bold text-[#EF4444] font-timer">-{formatMoney(cashOutflow)}</span>
                </div>

                {/* Final Expected Equation Line */}
                <div className="pt-2 border-t border-[#334155] flex items-center justify-between font-black text-base">
                  <span className="text-[#F8FAFC]">= EFECTIVO ESPERADO</span>
                  <span className="text-[#10B981] text-xl font-timer">{formatMoney(expectedCash)}</span>
                </div>
              </div>
            </div>

            {/* Other Payment Methods & Fiados (Information only, not in physical cash) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155]">
                <span className="text-xs text-[#94A3B8] block mb-1">
                  Ventas por Transferencia / QR
                </span>
                <span className="text-lg font-black text-[#3B82F6] font-timer">
                  {formatMoney(otherSales + otherDebtPayments)}
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-0.5">
                  Dinero en cuenta bancaria, no en caja física.
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155]">
                <span className="text-xs text-[#94A3B8] block mb-1">
                  Fiados registrados hoy ({debtsToday.length})
                </span>
                <span className="text-lg font-black text-[#F59E0B] font-timer">
                  {formatMoney(totalDebtsCreatedToday)}
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-0.5">
                  Cuentas por cobrar en la libreta.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Count & Close Form */}
          <div className="space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#273449] border border-[#334155] shadow-xl space-y-4">
              <h4 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <span>Contar y Cuadrar Caja</span>
              </h4>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1.5">
                  ¿Cuánto dinero en efectivo hay en la caja? *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#10B981] font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Ej. 145000"
                    value={countedCashInput}
                    onChange={(e) => setCountedCashInput(e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-8 pr-4 py-3 text-lg font-black text-[#10B981] font-timer focus:outline-hidden focus:border-[#10B981]"
                  />
                </div>
              </div>

              {/* Difference Calculation Pill */}
              {countedCashInput !== '' && (
                <div
                  className={`p-3.5 rounded-xl border ${
                    cashDifference === 0
                      ? 'bg-[#10B981]/15 border-[#10B981]/30 text-[#34D399]'
                      : cashDifference > 0
                      ? 'bg-[#3B82F6]/15 border-[#3B82F6]/30 text-[#3B82F6]'
                      : 'bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span>Resultado del Cuadre:</span>
                    <span>
                      {cashDifference === 0
                        ? '🟢 Cuadrado Exacto'
                        : cashDifference > 0
                        ? '🔵 Sobrante (+)'
                        : '🔴 Faltante (-)'}
                    </span>
                  </div>
                  <div className="text-xl font-black mt-1 font-timer">
                    {cashDifference === 0 ? '$0' : formatMoney(cashDifference)}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Observaciones / Notas:</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Turno de noche, se dejaron $30.000 de base"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-2.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981] resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handlePerformClosing}
                disabled={isSubmitting || !countedCashInput}
                className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-40 text-white font-black text-sm shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando Cierre...' : 'REALIZAR CIERRE DEL DÍA'}</span>
              </button>

              {closedSuccess && (
                <div className="p-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#34D399] text-xs text-center font-bold">
                  ✓ Cierre registrado exitosamente.
                </div>
              )}
            </div>

            {/* Quick Summary of Tables Activity Today */}
            <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155] text-xs space-y-2">
              <span className="font-bold text-[#94A3B8] uppercase tracking-wide block">
                Resumen Operativo del Turno
              </span>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Cobrado por tiempo de mesas:</span>
                <span className="font-semibold text-[#F8FAFC] font-timer">{formatMoney(totalTimePlayedAmount)}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Cobrado por productos/consumos:</span>
                <span className="font-semibold text-[#F8FAFC] font-timer">{formatMoney(totalItemsSoldAmount)}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Total partidas cobradas:</span>
                <span className="font-semibold text-[#F8FAFC] font-timer">{salesToday.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CAJA DE BOLSILLO (+ Meter / - Sacar) */}
      {activeSubTab === 'movements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#F8FAFC]">Movimientos de Caja de Bolsillo</h3>
            <button
              onClick={() => setShowAddMovementModal(true)}
              className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Movimiento (+ / -)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155]">
              <span className="text-xs font-bold text-[#10B981] uppercase">
                Total Ingresos Manuales (+)
              </span>
              <div className="text-2xl font-black text-[#10B981] mt-1 font-timer">
                +{formatMoney(cashInflow)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155]">
              <span className="text-xs font-bold text-[#EF4444] uppercase">
                Total Egresos Manuales (-)
              </span>
              <div className="text-2xl font-black text-[#EF4444] mt-1 font-timer">
                -{formatMoney(cashOutflow)}
              </div>
            </div>
          </div>

          {/* Movements List */}
          <div className="space-y-2">
            {cashMovementsToday.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#273449] border border-[#334155] text-xs text-[#94A3B8]">
                No hay movimientos de dinero registrados hoy.
              </div>
            ) : (
              cashMovementsToday.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#273449] border border-[#334155]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        m.type === 'ingreso'
                          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                          : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                      }`}
                    >
                      {m.type === 'ingreso' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#F8FAFC]">{m.concept}</div>
                      <div className="text-[11px] text-[#94A3B8] font-timer">
                        {new Date(m.created_at).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-base font-black font-timer ${
                      m.type === 'ingreso' ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {m.type === 'ingreso' ? '+' : '-'} {formatMoney(m.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. HISTORIAL DE CIERRES */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[#F8FAFC]">Historial de Cierres Diarios</h3>

          {closingHistory.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#273449] border border-[#334155] text-xs text-[#94A3B8]">
              Aún no se han registrado cierres diarios.
            </div>
          ) : (
            <div className="space-y-3">
              {closingHistory.map((cl) => (
                <div
                  key={cl.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#273449] border border-[#334155] space-y-3 shadow-lg"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#334155]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#10B981]" />
                      <span className="font-bold text-sm text-[#F8FAFC]">
                        Cierre del {cl.date}
                      </span>
                      <span className="text-xs text-[#94A3B8] font-timer">
                        ({new Date(cl.closed_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        cl.difference === 0
                          ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30'
                          : cl.difference > 0
                          ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30'
                          : 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                      }`}
                    >
                      {cl.difference === 0
                        ? 'Cuadrado'
                        : cl.difference > 0
                        ? `Sobrante +${formatMoney(cl.difference)}`
                        : `Faltante ${formatMoney(cl.difference)}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-[#1E293B] border border-[#334155]">
                      <span className="text-[#94A3B8] block text-[11px]">Ventas Efectivo:</span>
                      <span className="font-bold text-[#F8FAFC] font-timer">{formatMoney(cl.cash_sales)}</span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#1E293B] border border-[#334155]">
                      <span className="text-[#94A3B8] block text-[11px]">Abonos Efectivo:</span>
                      <span className="font-bold text-[#F8FAFC] font-timer">{formatMoney(cl.cash_debt_payments)}</span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#1E293B] border border-[#334155]">
                      <span className="text-[#94A3B8] block text-[11px]">Efectivo Esperado:</span>
                      <span className="font-bold text-[#10B981] font-timer">{formatMoney(cl.expected_cash)}</span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#1E293B] border border-[#334155]">
                      <span className="text-[#94A3B8] block text-[11px]">Efectivo Contado:</span>
                      <span className="font-bold text-[#F8FAFC] font-timer">{formatMoney(cl.counted_cash)}</span>
                    </div>
                  </div>

                  {cl.notes && (
                    <div className="text-xs text-[#94A3B8] italic">
                      Nota: "{cl.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Movement Modal */}
      {showAddMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC] relative">
            <h3 className="text-lg font-bold text-[#F8FAFC] mb-4">Registrar Movimiento de Caja</h3>

            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('egreso')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    movementType === 'egreso'
                      ? 'bg-[#EF4444] text-white border-[#EF4444]'
                      : 'bg-[#1E293B] text-[#94A3B8] border-[#334155]'
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>Sacar Dinero (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('ingreso')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    movementType === 'ingreso'
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#1E293B] text-[#94A3B8] border-[#334155]'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Meter Dinero (+)</span>
                </button>
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Monto ($) *</label>
                <input
                  type="number"
                  required
                  min="100"
                  step="100"
                  placeholder="Ej. 15000"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-base font-bold text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Concepto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Compra de hielo o Base del día"
                  value={movementConcept}
                  onChange={(e) => setMovementConcept(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {quickConcepts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setMovementConcept(q)}
                      className="px-2.5 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] text-[11px] cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMovementModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold border border-[#334155] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
