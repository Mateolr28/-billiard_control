import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { BilliardTable } from '../types';
import { billiardService } from '../services/billiardService';

interface CreateTableModalProps {
  existingTables: BilliardTable[];
  onClose: () => void;
  onCreated: (table: BilliardTable) => void;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  existingTables,
  onClose,
  onCreated,
}) => {
  // Suggest next table number
  const maxNumber = existingTables.length > 0 ? Math.max(...existingTables.map((t) => t.number)) : 0;
  const nextNumber = maxNumber + 1;

  const [number, setNumber] = useState<number>(nextNumber);
  const [name, setName] = useState<string>(`Mesa ${nextNumber}`);
  const [hourlyRate, setHourlyRate] = useState<number>(10000);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(`Mesa ${number}`);
  }, [number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!number || number <= 0) {
      setError('El número de mesa debe ser mayor a 0');
      return;
    }

    if (existingTables.some((t) => t.number === number)) {
      setError(`Ya existe una mesa con el número ${number}`);
      return;
    }

    if (hourlyRate < 0) {
      setError('La tarifa por hora no puede ser negativa');
      return;
    }

    try {
      setLoading(true);
      const newTable = await billiardService.createTable(number, name, hourlyRate);
      onCreated(newTable);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al crear la mesa');
    } finally {
      setLoading(false);
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
          <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-[#10B981] flex items-center justify-center border border-[#334155]">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#F8FAFC]">Agregar Nueva Mesa</h2>
            <p className="text-xs text-[#94A3B8]">Configura el número y tarifa de la mesa</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#EF4444]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Número de Mesa
            </label>
            <input
              type="number"
              min="1"
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
              required
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-base font-bold text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Nombre o Identificador
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mesa 7, Mesa VIP, Mesa Carambola"
              required
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Tarifa por Hora ($ COP)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-[#94A3B8] font-bold">$</span>
              <input
                type="number"
                step="500"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                required
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-8 pr-3.5 py-2.5 text-base font-bold text-[#10B981] font-timer focus:outline-hidden focus:border-[#10B981]"
              />
            </div>
            {/* Quick rate presets */}
            <div className="flex gap-2 mt-2">
              {[8000, 10000, 12000, 15000].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setHourlyRate(rate)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer font-timer ${
                    hourlyRate === rate
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#1E293B] text-[#F8FAFC] border-[#334155] hover:border-[#475569]'
                  }`}
                >
                  ${rate.toLocaleString('es-CO')}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#334155] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] font-bold text-sm text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 font-bold text-sm text-white shadow-lg transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Guardando...' : 'Crear Mesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
