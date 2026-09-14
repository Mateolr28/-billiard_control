import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, UserCheck, X, AlertOctagon, Clock, ShoppingBag, Banknote, CreditCard, QrCode } from 'lucide-react';
import { db } from '../db';
import { TableSession, PaymentMethod } from '../types';
import { billiardService } from '../services/billiardService';
import { calculateElapsedSeconds, calculateTimeCost, formatDuration, formatMoney } from '../utils/billing';

interface CheckoutModalProps {
  session: TableSession;
  tableNumber: number;
  onClose: () => void;
  onCompleted: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  session,
  tableNumber,
  onClose,
  onCompleted,
}) => {
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  const items =
    useLiveQuery(
      () => db.session_items.where('session_id').equals(session.id).toArray(),
      [session.id]
    ) || [];

  const [activeTab, setActiveTab] = useState<'review' | 'cobrar' | 'fiar'>('review');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmFiar, setConfirmFiar] = useState(false);

  // Time & Money Calculation
  const elapsedSeconds = calculateElapsedSeconds(session, Date.now());
  const timeCost = calculateTimeCost(elapsedSeconds, session.hourly_rate);
  const itemsCost = items.reduce((acc, curr) => acc + curr.total_price, 0);
  const totalAmount = timeCost + itemsCost;

  const handleCobrar = async () => {
    setIsSubmitting(true);
    try {
      await billiardService.checkoutSession(session.id, paymentMethod, notes);
      onCompleted();
    } catch (err: any) {
      alert(err?.message || 'Error al registrar cobro');
      setIsSubmitting(false);
    }
  };

  const handleFiar = async () => {
    setIsSubmitting(true);
    try {
      let targetCustomerId = selectedCustomerId;

      // Quick create customer if new name typed
      if (!targetCustomerId && newCustomerName.trim()) {
        const newCust = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          name: newCustomerName.trim(),
          current_debt: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.customers.add(newCust);
        targetCustomerId = newCust.id;
      }

      if (!targetCustomerId) {
        alert('Por favor selecciona o escribe el nombre del cliente');
        setIsSubmitting(false);
        return;
      }

      await billiardService.chargeToDebt(session.id, targetCustomerId, notes);
      onCompleted();
    } catch (err: any) {
      alert(err?.message || 'Error al registrar fiado');
      setIsSubmitting(false);
    }
  };

  const handleCancelSession = async () => {
    if (window.confirm('¿Seguro que deseas cancelar esta partida y liberar la mesa sin cobrar?')) {
      setIsSubmitting(true);
      try {
        await billiardService.cancelSession(session.id, 'Cancelada desde el modal de cierre');
        onCompleted();
      } catch (err: any) {
        alert(err?.message || 'Error al cancelar');
        setIsSubmitting(false);
      }
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#334155] pr-8">
          <div className="w-12 h-12 rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 flex items-center justify-center text-xl font-black font-timer">
            {tableNumber}
          </div>
          <div>
            <h2 className="text-xl font-black text-[#F8FAFC]">Finalizar Mesa {tableNumber}</h2>
            <p className="text-xs text-[#94A3B8]">Resumen de cuenta y liquidación</p>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="mt-4 p-4 rounded-xl bg-[#1E293B] border border-[#334155] space-y-3">
          {/* Time row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#F8FAFC]">
              <Clock className="w-4 h-4 text-[#10B981]" />
              <span>Tiempo de Juego ({formatDuration(elapsedSeconds)})</span>
            </div>
            <span className="font-bold text-sm text-[#F8FAFC] font-timer">{formatMoney(timeCost)}</span>
          </div>

          {/* Consumptions row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#F8FAFC]">
              <ShoppingBag className="w-4 h-4 text-[#F59E0B]" />
              <span>Consumos ({items.reduce((a, b) => a + b.quantity, 0)} productos)</span>
            </div>
            <span className="font-bold text-sm text-[#F8FAFC] font-timer">{formatMoney(itemsCost)}</span>
          </div>

          {/* Items itemized detail */}
          {items.length > 0 && (
            <div className="pt-2 border-t border-[#334155] space-y-1 text-xs text-[#94A3B8] pl-6 font-timer">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>
                    {it.product_name} x{it.quantity}
                  </span>
                  <span>{formatMoney(it.total_price)}</span>
                </div>
              ))}
            </div>
          )}

          {/* TOTAL BANNER */}
          <div className="pt-3 border-t border-[#334155] flex items-center justify-between">
            <span className="text-base font-black text-[#F8FAFC] uppercase tracking-wider">TOTAL A PAGAR</span>
            <span className="text-2xl font-black text-[#10B981] font-timer">{formatMoney(totalAmount)}</span>
          </div>
        </div>

        {/* Action Views */}
        {activeTab === 'review' && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => setActiveTab('cobrar')}
              className="w-full py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-black text-base shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>COBRAR ({formatMoney(totalAmount)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fiar')}
              className="w-full py-3.5 px-4 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white font-bold text-sm shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <UserCheck className="w-5 h-5" />
              <span>FIAR A CLIENTE</span>
            </button>

            <button
              type="button"
              onClick={handleCancelSession}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl text-[#EF4444] hover:bg-[#EF4444]/10 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Cancelar partida sin cobrar</span>
            </button>
          </div>
        )}

        {/* COBRAR FLOW */}
        {activeTab === 'cobrar' && (
          <div className="mt-5 space-y-4 animate-fade-in">
            <div>
              <label className="text-xs font-bold text-[#94A3B8] block mb-2">
                Método de Pago:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`py-3 px-3 rounded-xl border flex items-center gap-2 font-bold text-sm transition cursor-pointer ${
                    paymentMethod === 'efectivo'
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:bg-[#334155]'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-[#10B981]" />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`py-3 px-3 rounded-xl border flex items-center gap-2 font-bold text-sm transition cursor-pointer ${
                    paymentMethod === 'transferencia'
                      ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:bg-[#334155]'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-[#3B82F6]" />
                  <span>Transferencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('qr')}
                  className={`py-2.5 px-3 rounded-xl border flex items-center gap-2 font-bold text-sm transition cursor-pointer ${
                    paymentMethod === 'qr'
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:bg-[#334155]'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-[#34D399]" />
                  <span>QR / Nequi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('otro')}
                  className={`py-2.5 px-3 rounded-xl border flex items-center gap-2 font-bold text-sm transition cursor-pointer ${
                    paymentMethod === 'otro'
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:bg-[#334155]'
                  }`}
                >
                  <span>Otro</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#94A3B8] block mb-1">Nota (opcional):</label>
              <input
                type="text"
                placeholder="Ej. Billete de $50.000"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('review')}
                className="flex-1 py-3 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-sm font-semibold border border-[#334155] transition cursor-pointer"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleCobrar}
                disabled={isSubmitting}
                className="flex-2 py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-black text-sm shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando...' : `CONFIRMAR PAGO`}</span>
              </button>
            </div>
          </div>
        )}

        {/* FIAR FLOW */}
        {activeTab === 'fiar' && (
          <div className="mt-5 space-y-4 animate-fade-in">
            {!confirmFiar ? (
              <>
                <div>
                  <label className="text-xs font-bold text-[#94A3B8] block mb-2">
                    Seleccionar cliente frecuente:
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      setNewCustomerName('');
                    }}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
                  >
                    <option value="">-- Elige un cliente existente --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Debe: {formatMoney(c.current_debt)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] block mb-1">
                    O registrar nuevo cliente:
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre del cliente"
                    value={newCustomerName}
                    onChange={(e) => {
                      setNewCustomerName(e.target.value);
                      setSelectedCustomerId('');
                    }}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('review')}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-sm font-semibold border border-[#334155] transition cursor-pointer"
                  >
                    Volver
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedCustomerId && !newCustomerName.trim()) {
                        alert('Selecciona un cliente o escribe un nombre nuevo');
                        return;
                      }
                      setConfirmFiar(true);
                    }}
                    className="flex-2 py-3 px-4 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white font-bold text-sm shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Continuar</span>
                  </button>
                </div>
              </>
            ) : (
              /* Confirmation Prompt */
              <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#F59E0B]/50 text-center space-y-4 shadow-xl">
                <div className="text-3xl">⚠️</div>
                <div>
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    ¿Registrar <span className="text-[#EF4444] font-timer">{formatMoney(totalAmount)}</span> como deuda?
                  </h3>
                  <p className="text-xs text-[#F59E0B] mt-1">
                    Cliente: <strong>{selectedCustomer?.name || newCustomerName}</strong>
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-1">
                    Este valor NO se sumará al efectivo de la caja. Se guardará en la libreta de fiados.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmFiar(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#273449] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-sm font-semibold border border-[#334155] transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleFiar}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white font-bold text-sm shadow-lg transition active:scale-98 cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Sí, Fiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
