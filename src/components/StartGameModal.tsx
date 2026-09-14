import React, { useState } from 'react';
import { Play, Clock, X, Zap } from 'lucide-react';
import { BilliardTable } from '../types';
import { formatMoney } from '../utils/billing';

interface StartGameModalProps {
  table: BilliardTable;
  onClose: () => void;
  onStart: (tableId: string, mode: 'libre' | 'prepago', minutes?: number) => Promise<void>;
}

export const StartGameModal: React.FC<StartGameModalProps> = ({ table, onClose, onStart }) => {
  const [mode, setMode] = useState<'libre' | 'prepago'>('libre');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(60);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickMinutes = [15, 30, 45, 60, 90, 120];

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const minutes = mode === 'prepago' ? (customMinutes ? parseInt(customMinutes, 10) : selectedMinutes) : undefined;
      await onStart(table.id, mode, minutes);
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Error al iniciar partida');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#1E293B] border border-[#334155] text-[#10B981] flex items-center justify-center text-xl font-black font-timer">
            {table.number}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#F8FAFC]">{table.name}</h2>
            <p className="text-xs text-[#94A3B8]">
              Tarifa actual: <span className="text-[#F8FAFC] font-semibold font-timer">{formatMoney(table.hourly_rate)}</span> / hora
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#1E293B] rounded-xl mb-5 border border-[#334155]">
          <button
            type="button"
            onClick={() => setMode('libre')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition cursor-pointer ${
              mode === 'libre'
                ? 'bg-[#10B981] text-white shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Tiempo Libre</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('prepago')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition cursor-pointer ${
              mode === 'prepago'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Prepago</span>
          </button>
        </div>

        {mode === 'prepago' && (
          <div className="mb-6 space-y-3">
            <label className="text-xs font-semibold text-[#F8FAFC] block">
              Seleccionar tiempo contratado:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {quickMinutes.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setSelectedMinutes(mins);
                    setCustomMinutes('');
                  }}
                  className={`py-3 px-2 rounded-xl text-center font-bold text-sm border transition cursor-pointer ${
                    selectedMinutes === mins && !customMinutes
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-sm'
                      : 'bg-[#1E293B] text-[#F8FAFC] border-[#334155] hover:border-[#475569]'
                  }`}
                >
                  <span className="font-timer">{mins} min</span>
                  <div className="text-[11px] font-normal opacity-75 font-timer">
                    {formatMoney((table.hourly_rate / 60) * mins)}
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="text-xs text-[#94A3B8] block mb-1">O personalizar minutos:</label>
              <input
                type="number"
                min="1"
                placeholder="Ej. 50"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#3B82F6]"
              />
            </div>
          </div>
        )}

        {mode === 'libre' && (
          <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155] text-xs text-[#94A3B8] mb-6 space-y-1">
            <p className="font-semibold text-[#10B981] flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Cobro exacto por minuto jugado
            </p>
            <p>
              El cronómetro correrá hasta que finalices o pauses la partida. Se cobrará a razón de{' '}
              <strong className="text-[#F8FAFC] font-timer">{formatMoney(table.hourly_rate / 60)}</strong> por minuto.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] font-semibold text-sm transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`flex-2 py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
              mode === 'prepago' ? 'bg-[#3B82F6] hover:bg-[#3B82F6]/90' : 'bg-[#10B981] hover:bg-[#10B981]/90'
            }`}
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isSubmitting ? 'Iniciando...' : 'INICIAR JUEGO'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
