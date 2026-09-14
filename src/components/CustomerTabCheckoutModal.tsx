import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle,
  X,
  Banknote,
  Smartphone,
  CreditCard,
  UserCheck,
  MapPin,
  Calendar,
  ShoppingBag,
} from 'lucide-react';
import { db } from '../db';
import { CustomerTab, PaymentMethod } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';
import { soundService } from '../utils/sound';

interface CustomerTabCheckoutModalProps {
  tab: CustomerTab;
  onClose: () => void;
  onCompleted: () => void;
}

export const CustomerTabCheckoutModal: React.FC<CustomerTabCheckoutModalProps> = ({
  tab,
  onClose,
  onCompleted,
}) => {
  // Query consumed items
  const items =
    useLiveQuery(
      () => db.customer_tab_items.where('tab_id').equals(tab.id).toArray(),
      [tab.id]
    ) || [];

  // Query customers for debt transfer
  const customers =
    useLiveQuery(
      () => db.customers.toArray().then((arr) => arr.sort((a, b) => a.name.localeCompare(b.name))),
      []
    ) || [];

  const totalAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashGiven, setCashGiven] = useState<number>(totalAmount);
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Transfer to debt state
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(tab.customer_id || '');
  const [debtNotes, setDebtNotes] = useState<string>('');

  const change = Math.max(0, cashGiven - totalAmount);

  const handleCashShortcuts = (bill: number) => {
    setCashGiven(bill);
  };

  const handleConfirmPayment = async () => {
    if (items.length === 0) {
      alert('Esta cuenta no tiene consumos registrados para cobrar.');
      return;
    }

    try {
      setIsProcessing(true);
      await billiardService.checkoutCustomerTab(tab.id, paymentMethod, notes);
      onCompleted();
    } catch (err: any) {
      alert(err?.message || 'Error al registrar el cobro de la cuenta');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePassToDebt = async () => {
    try {
      setIsProcessing(true);
      await billiardService.customerTabToDebt(
        tab.id,
        selectedCustomerId || undefined,
        debtNotes || undefined
      );
      onCompleted();
    } catch (err: any) {
      alert(err?.message || 'Error al pasar a libreta de fiados');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3 text-[#10B981]">
          <span className="text-2xl">🧾</span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block">
              Cobrar y Cerrar Cuenta
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#F8FAFC]">{tab.customer_name}</h2>
              {tab.location && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#1E293B] text-[#3B82F6] border border-[#334155] font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {tab.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Consumptions Breakdown */}
        <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#334155] mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-bold uppercase pb-1 border-b border-[#334155]">
            <span className="flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-[#10B981]" />
              Detalle de Consumos ({items.length})
            </span>
            <span>Subtotal</span>
          </div>

          <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 text-xs">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span>{it.product_icon || '📦'}</span>
                  <span className="text-[#F8FAFC] font-medium">
                    {it.quantity}x {it.product_name}
                  </span>
                  <span className="text-[#94A3B8] text-[11px] font-timer">
                    ({formatMoney(it.unit_price)})
                  </span>
                </div>
                <span className="font-bold text-[#F8FAFC] font-timer">
                  {formatMoney(it.total_price)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#334155] flex items-center justify-between">
            <span className="text-sm font-black text-[#F8FAFC] uppercase">Total a Cobrar:</span>
            <span className="text-2xl font-black text-[#10B981] font-timer">
              {formatMoney(totalAmount)}
            </span>
          </div>
        </div>

        {!showDebtForm ? (
          <div className="space-y-4">
            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-bold text-[#94A3B8] block mb-1.5">
                Método de Pago:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                    paymentMethod === 'efectivo'
                      ? 'bg-[#10B981] border-[#10B981] text-white shadow-md'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                    paymentMethod === 'transferencia'
                      ? 'bg-[#10B981] border-[#10B981] text-white shadow-md'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Nequi / Daviplata</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('tarjeta')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                    paymentMethod === 'tarjeta'
                      ? 'bg-[#10B981] border-[#10B981] text-white shadow-md'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Tarjeta</span>
                </button>
              </div>
            </div>

            {/* Cash Shortcuts and Change calculator */}
            {paymentMethod === 'efectivo' && (
              <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#94A3B8]">Paga con (Billetes rápidos):</span>
                  <button
                    type="button"
                    onClick={() => setCashGiven(totalAmount)}
                    className="text-[11px] text-[#10B981] font-bold hover:underline cursor-pointer font-timer"
                  >
                    Exacto ({formatMoney(totalAmount)})
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[10000, 20000, 50000, 100000].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleCashShortcuts(bill)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer font-timer ${
                        cashGiven === bill
                          ? 'bg-[#10B981] text-white border-[#10B981]'
                          : 'bg-[#273449] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155]'
                      }`}
                    >
                      ${bill / 1000}k
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] block mb-1">Recibido ($)</label>
                    <input
                      type="number"
                      value={cashGiven || ''}
                      onChange={(e) => setCashGiven(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#273449] border border-[#334155] rounded-xl px-3 py-2 text-base font-bold text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
                    />
                  </div>

                  <div className="p-2 rounded-xl bg-[#273449] border border-[#334155] flex flex-col justify-center">
                    <span className="text-[11px] text-[#94A3B8] block">Cambio / Vueltas:</span>
                    <span
                      className={`text-lg font-black font-timer ${
                        change >= 0 ? 'text-[#34D399]' : 'text-[#EF4444]'
                      }`}
                    >
                      {formatMoney(change)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <input
                type="text"
                placeholder="Nota adicional (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isProcessing || (paymentMethod === 'efectivo' && cashGiven < totalAmount)}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 text-white font-black text-sm shadow-xl transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 font-timer"
              >
                <CheckCircle className="w-5 h-5" />
                <span>CONFIRMAR PAGO ({formatMoney(totalAmount)})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDebtForm(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/30 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Pasar a Libreta de Fiados (Paga después)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Transfer to Debt form */
          <div className="space-y-4 p-4 rounded-2xl bg-[#1E293B] border border-[#F59E0B]/40">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#F59E0B] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" /> Registrar como Fiado
              </h4>
              <button
                type="button"
                onClick={() => setShowDebtForm(false)}
                className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                Volver a cobrar
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F8FAFC] block mb-1">
                Cliente en libreta de fiados:
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-[#273449] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-hidden focus:border-[#F59E0B]"
              >
                <option value="">
                  -- Registrar con el nombre actual: "{tab.customer_name}" --
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Deuda actual: {formatMoney(c.current_debt)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#F8FAFC] block mb-1">
                Nota o fecha de compromiso de pago:
              </label>
              <input
                type="text"
                placeholder="Ej: Paga el sábado con la quincena"
                value={debtNotes}
                onChange={(e) => setDebtNotes(e.target.value)}
                className="w-full bg-[#273449] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#F59E0B]"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDebtForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#273449] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePassToDebt}
                disabled={isProcessing}
                className="flex-2 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0F172A] text-xs font-black shadow-lg transition active:scale-98 cursor-pointer font-timer"
              >
                Confirmar Fiado ({formatMoney(totalAmount)})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
