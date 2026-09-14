import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  CheckCircle,
  MapPin,
  Clock,
  Trash2,
  Wine,
} from 'lucide-react';
import { CustomerTab } from '../types';
import { db } from '../db';
import { formatMoney } from '../utils/billing';
import { billiardService } from '../services/billiardService';

interface CustomerTabCardProps {
  tab: CustomerTab;
  onOpenConsumption: (tab: CustomerTab) => void;
  onOpenCheckout: (tab: CustomerTab) => void;
}

export const CustomerTabCard: React.FC<CustomerTabCardProps> = ({
  tab,
  onOpenConsumption,
  onOpenCheckout,
}) => {
  const items =
    useLiveQuery(
      () => db.customer_tab_items.where('tab_id').equals(tab.id).toArray(),
      [tab.id]
    ) || [];

  const totalAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);

  // Time elapsed since tab was opened
  const getElapsedMinutes = () => {
    const start = new Date(tab.created_at).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - start) / 60000);
    if (diffMin < 1) return 'Recién abierta';
    if (diffMin < 60) return `${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m`;
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `¿Eliminar la comanda de ${tab.customer_name}? Si tenía consumos registrados, se cancelarán.`
      )
    ) {
      await billiardService.deleteCustomerTab(tab.id);
    }
  };

  return (
    <div className="rounded-2xl border border-[#334155] bg-[#273449] p-4 sm:p-5 transition-all duration-150 flex flex-col justify-between relative overflow-hidden shadow-lg">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#3B82F6] shadow-inner">
              <Wine className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg text-[#F8FAFC] tracking-tight uppercase">
                  {tab.customer_name}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] mt-0.5 font-medium">
                <span className="flex items-center gap-1 text-[#3B82F6] font-semibold">
                  <MapPin className="w-3 h-3" /> {tab.location || 'Barra'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#94A3B8]" /> {getElapsedMinutes()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#1E293B] text-[#3B82F6] border border-[#334155]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
              PAGA AL SALIR
            </span>
            <button
              type="button"
              onClick={handleDelete}
              title="Cancelar comanda"
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#1E293B] transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Consumed items preview (Bar Ticket Style) */}
        <div className="py-3">
          <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] mb-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-bold uppercase tracking-wider mb-1.5">
              <span>Comanda ({items.reduce((a, b) => a + b.quantity, 0)} unid.):</span>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-[#94A3B8] italic py-1">
                Sin productos anotados todavía. Usa "+ Consumo".
              </p>
            ) : (
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#F8FAFC] font-medium truncate pr-2">
                      {it.quantity}x {it.product_name}
                    </span>
                    <span className="font-timer font-bold text-[#94A3B8] shrink-0">
                      {formatMoney(it.total_price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total Accumulated Box */}
          <div className="p-2.5 px-3 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-between">
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
              Total Consumido:
            </span>
            <span className="text-xl font-black text-[#10B981] font-timer">
              {formatMoney(totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-[#334155] grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenConsumption(tab)}
          className="py-2.5 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] active:scale-95 text-[#F8FAFC] border border-[#334155] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#10B981]" />
          <span>+ CONSUMO</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenCheckout(tab)}
          disabled={items.length === 0}
          className="py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-40 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
        >
          <CheckCircle className="w-4 h-4" />
          <span>COBRAR CUENTA</span>
        </button>
      </div>
    </div>
  );
};
