import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, UserCheck, MapPin, Plus, Sparkles } from 'lucide-react';
import { db } from '../db';
import { billiardService } from '../services/billiardService';
import { soundService } from '../utils/sound';

interface OpenCustomerTabModalProps {
  onClose: () => void;
  onSuccess: (tabId: string) => void;
}

export const OpenCustomerTabModal: React.FC<OpenCustomerTabModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Barra');
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing registered customers for quick selection
  const existingCustomers =
    useLiveQuery(() => db.customers.toArray().then((arr) => arr.sort((a, b) => a.name.localeCompare(b.name))), []) || [];

  const commonLocations = [
    'Barra',
    'Mostrador',
    'Sillas de Espera',
    'Terraza',
    'Mesa de Cartas',
    'Mesa 1',
    'Mesa 2',
    'Mesa 3',
    'Mesa 4',
    'Mesa 5',
    'Mesa 6',
  ];

  const handleSelectExistingCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const found = existingCustomers.find((c) => c.id === id);
    if (found) {
      setCustomerName(found.name);
      if (found.phone) setPhone(found.phone);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Ingresa el nombre o apodo del cliente');
      return;
    }

    try {
      setIsSubmitting(true);
      const newTab = await billiardService.openCustomerTab(customerName, {
        customerId: selectedCustomerId || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || 'Barra',
        notes: notes.trim() || undefined,
      });

      soundService.playCashPing();
      onSuccess(newTab.id);
    } catch (err: any) {
      alert(err?.message || 'Error al abrir cuenta para cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1 text-[#10B981]">
          <span className="text-2xl">🍹</span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block">
              Consumo por Pagar al Salir
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
              Abrir Cuenta a Cliente
            </h2>
          </div>
        </div>

        <p className="text-xs text-[#94A3B8] mb-4">
          Crea una cuenta abierta para un cliente que está consumiendo en la barra o billar y pagará al final.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick picker from registered customers */}
          {existingCustomers.length > 0 && (
            <div>
              <label className="text-xs font-bold text-[#F8FAFC] mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#10B981]" />
                <span>¿Es un cliente registrado o frecuente? (Opcional)</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectExistingCustomer(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
              >
                <option value="">-- Nuevo cliente o escribir nombre abajo --</option>
                {existingCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Name or Alias */}
          <div>
            <label className="text-xs font-bold text-[#F8FAFC] block mb-1">
              Nombre o Apodo del Cliente <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Don Pedro, Andrés Barra, El Flaco, etc."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              autoFocus
              required
            />
          </div>

          {/* Location / Ubicación */}
          <div>
            <label className="text-xs font-bold text-[#F8FAFC] mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Ubicación en el local</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {commonLocations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    location === loc
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] hover:bg-[#334155]'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Otra ubicación..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-1.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          {/* Phone / WhatsApp (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#94A3B8] block mb-1">
                Teléfono / Celular (Opcional)
              </label>
              <input
                type="tel"
                placeholder="Ej: 300 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#94A3B8] block mb-1">
                Nota adicional (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Amigo de Juan, gorra roja"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#334155] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerName.trim()}
              className="flex-2 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 text-white text-xs font-black shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
            >
              <Sparkles className="w-4 h-4" />
              <span>ABRIR CUENTA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
