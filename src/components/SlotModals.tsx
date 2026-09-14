import React, { useState } from 'react';
import {
  X,
  Plus,
  Trophy,
  Coins,
  TrendingDown,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertCircle,
  Building,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { SlotMachine, SlotMachineStatus } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';

// ============================================================================
// 1. MODAL: AGREGAR NUEVA MAQUINITA TRAGAMONEDAS
// ============================================================================
interface AddSlotMachineModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddSlotMachineModal: React.FC<AddSlotMachineModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [coinDenomination, setCoinDenomination] = useState('500');
  const [initialBalance, setInitialBalance] = useState('100000');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const quickBalances = [50000, 100000, 150000, 200000, 300000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor ingresa un nombre para la máquina');
      return;
    }

    const initBal = parseFloat(initialBalance);
    if (isNaN(initBal) || initBal < 0) {
      setError('El dinero inicial debe ser un monto válido mayor o igual a 0');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await billiardService.createSlotMachine({
        name: name.trim(),
        code: code.trim() || undefined,
        location: location.trim() || undefined,
        coin_denomination: parseFloat(coinDenomination) || 500,
        initial_balance: initBal,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la máquina');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-xl">
            🎰
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F8FAFC]">Nueva Maquinita Tragamonedas</h3>
            <p className="text-xs text-[#94A3B8]">Registra la máquina y su dinero o fondo inicial</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Nombre de la Máquina *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Tragamonedas Frutas #1, Poker Real..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                Código / Identificador
              </label>
              <input
                type="text"
                placeholder="Ej: TM-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm font-timer text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                Ubicación en el local
              </label>
              <input
                type="text"
                placeholder="Ej: Junto a Mesa 1"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Valor de Ficha / Moneda de juego
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['200', '500', '1000', '2000'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCoinDenomination(val)}
                  className={`py-1.5 rounded-xl border text-xs font-bold font-timer transition cursor-pointer ${
                    coinDenomination === val
                      ? 'bg-[#10B981] border-[#10B981] text-white shadow-sm'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>

          {/* Dinero inicial que tiene la máquina */}
          <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#10B981]" />
                ¿Cuánto dinero tiene inicialmente? ($)
              </label>
              <span className="text-[11px] text-[#34D399] font-timer font-bold">
                {formatMoney(parseFloat(initialBalance) || 0)}
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Fondo cargado en tolva para dar premios a los primeros jugadores o vuelto.
            </p>
            <input
              type="number"
              min="0"
              step="1000"
              required
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full bg-[#273449] border border-[#334155] rounded-xl px-3 py-2 text-base font-bold text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
            />
            {/* Quick buttons */}
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {quickBalances.map((qb) => (
                <button
                  key={qb}
                  type="button"
                  onClick={() => setInitialBalance(qb.toString())}
                  className={`py-1 text-[11px] font-bold font-timer rounded-lg border transition cursor-pointer ${
                    initialBalance === qb.toString()
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#34D399]'
                      : 'bg-[#273449] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  ${qb / 1000}k
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Notas adicionales (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Tolva recién aceitada, paga combinaciones de bar"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 text-white text-xs font-black shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Registrar Maquinita'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. MODAL: REGISTRAR PREMIO / DINERO QUE LE SACARON LOS JUGADORES
// ============================================================================
interface SlotPayoutModalProps {
  machine: SlotMachine;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SlotPayoutModal: React.FC<SlotPayoutModalProps> = ({ machine, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [deductFromMachine, setDeductFromMachine] = useState(true);
  const [payFromCash, setPayFromCash] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const quickPayouts = [10000, 20000, 30000, 50000, 100000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Ingresa un monto válido para el dinero sacado');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await billiardService.recordSlotPayout({
        machineId: machine.id,
        amount: amountNum,
        playerName: playerName.trim() || undefined,
        notes: notes.trim() || undefined,
        deductFromMachineBalance: deductFromMachine,
        payFromGeneralCash: payFromCash,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el premio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center text-xl text-[#EF4444]">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-[#EF4444] tracking-wider">
              Premio / Retiro de Jugador
            </span>
            <h3 className="text-base font-black text-[#F8FAFC]">{machine.name}</h3>
            <p className="text-xs text-[#94A3B8]">Dinero que le han sacado los jugadores</p>
          </div>
        </div>

        {/* Machine cash info */}
        <div className="p-3 rounded-2xl bg-[#1E293B] border border-[#334155] mb-4 flex items-center justify-between text-xs">
          <span className="text-[#94A3B8]">Dinero actual en la máquina:</span>
          <span className="text-sm font-black text-[#34D399] font-timer">
            {formatMoney(machine.current_balance)}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#F8FAFC] block mb-1">
              ¿Cuánto dinero sacó el jugador? ($) *
            </label>
            <input
              type="number"
              min="1"
              step="500"
              required
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xl font-black text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#EF4444]"
            />
            {/* Quick shortcuts */}
            <div className="grid grid-cols-5 gap-1.5 pt-2">
              {quickPayouts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => setAmount(qp.toString())}
                  className={`py-1 text-xs font-bold font-timer rounded-lg border transition cursor-pointer ${
                    amount === qp.toString()
                      ? 'bg-[#EF4444] text-white border-[#EF4444]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  ${qp / 1000}k
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Nombre del Jugador / Cliente (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Carlos, Pedro, Cliente de la mesa 3..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#EF4444]"
            />
          </div>

          {/* Options */}
          <div className="space-y-2 p-3 rounded-2xl bg-[#1E293B] border border-[#334155] text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deductFromMachine}
                onChange={(e) => setDeductFromMachine(e.target.checked)}
                className="rounded text-[#EF4444] focus:ring-0 cursor-pointer"
              />
              <span className="text-[#F8FAFC]">
                Descontar del saldo de la máquina{' '}
                <span className="text-[#94A3B8]">(Salió de la tolva)</span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none pt-1 border-t border-[#334155]">
              <input
                type="checkbox"
                checked={payFromCash}
                onChange={(e) => setPayFromCash(e.target.checked)}
                className="rounded text-[#F59E0B] focus:ring-0 cursor-pointer"
              />
              <span className="text-[#F8FAFC]">
                Registrar salida en Caja General del billar{' '}
                <span className="text-[#94A3B8]">(Se pagó desde la caja)</span>
              </span>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Detalle o jugada ganadora (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Trío de campanas, premio mayor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#EF4444]"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#EF4444]/90 disabled:opacity-50 text-white text-xs font-black shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
            >
              <Trophy className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando...' : `Confirmar Salida (${formatMoney(parseFloat(amount) || 0)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. MODAL: REGISTRAR RECAUDACIÓN / MONEDAS INGRESADAS POR JUGADORES
// ============================================================================
interface SlotIncomeModalProps {
  machine: SlotMachine;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SlotIncomeModal: React.FC<SlotIncomeModalProps> = ({ machine, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const quickIncomes = [20000, 50000, 100000, 150000, 200000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Ingresa un monto válido de recaudación');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await billiardService.recordSlotIncome({
        machineId: machine.id,
        amount: amountNum,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el ingreso');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-xl text-[#10B981]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-[#10B981] tracking-wider">
              Recaudación de Jugadas
            </span>
            <h3 className="text-base font-black text-[#F8FAFC]">{machine.name}</h3>
            <p className="text-xs text-[#94A3B8]">Dinero o monedas ingresadas por los jugadores</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#F8FAFC] block mb-1">
              Monto Ingresado / Recaudado ($) *
            </label>
            <input
              type="number"
              min="1"
              step="500"
              required
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xl font-black text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
            />
            {/* Quick shortcuts */}
            <div className="grid grid-cols-5 gap-1.5 pt-2">
              {quickIncomes.map((qi) => (
                <button
                  key={qi}
                  type="button"
                  onClick={() => setAmount(qi.toString())}
                  className={`py-1 text-xs font-bold font-timer rounded-lg border transition cursor-pointer ${
                    amount === qi.toString()
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  ${qi / 1000}k
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Nota u observaciones (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Conteo monedas turno de la tarde..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8]">Nuevo saldo proyectado en tolva:</span>
            <span className="text-sm font-black text-[#34D399] font-timer">
              {formatMoney(machine.current_balance + (parseFloat(amount) || 0))}
            </span>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 text-white text-xs font-black shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : `Registrar Ingreso (+${formatMoney(parseFloat(amount) || 0)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. MODAL: ARQUEO FÍSICO O RECARGA DE FONDO (CUÁNTO DINERO TIENE LA MÁQUINA)
// ============================================================================
interface SlotBalanceModalProps {
  machine: SlotMachine;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SlotBalanceModal: React.FC<SlotBalanceModalProps> = ({ machine, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'set_total' | 'reload_fund'>('set_total');
  const [amount, setAmount] = useState(machine.current_balance.toString());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amountNum = parseFloat(amount) || 0;
  const difference = mode === 'set_total' ? amountNum - machine.current_balance : amountNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(amountNum) || amountNum < 0) {
      setError('Ingresa un monto válido');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await billiardService.adjustSlotBalance({
        machineId: machine.id,
        amount: amountNum,
        mode,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar saldo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-xl text-[#3B82F6]">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-[#3B82F6] tracking-wider">
              Control de Dinero en Máquina
            </span>
            <h3 className="text-base font-black text-[#F8FAFC]">{machine.name}</h3>
            <p className="text-xs text-[#94A3B8]">Arqueo de cuánto dinero tiene o recargar fondo</p>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#1E293B] border border-[#334155] rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('set_total');
              setAmount(machine.current_balance.toString());
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              mode === 'set_total'
                ? 'bg-[#3B82F6] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Arqueo / Conteo Exacto
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('reload_fund');
              setAmount('50000');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              mode === 'reload_fund'
                ? 'bg-[#10B981] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            + Recargar Fondo
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#F8FAFC] block mb-1">
              {mode === 'set_total'
                ? '¿Cuánto dinero tiene físicamente la máquina? ($)'
                : '¿Cuánto dinero le recargas a la máquina? ($)'}
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xl font-black text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#3B82F6]"
            />
          </div>

          {/* Comparison summary */}
          <div className="p-3 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Saldo actual registrado:</span>
              <span className="font-bold text-[#F8FAFC] font-timer">
                {formatMoney(machine.current_balance)}
              </span>
            </div>

            {mode === 'set_total' ? (
              <div className="flex items-center justify-between pt-1 border-t border-[#334155]">
                <span className="text-[#94A3B8]">Diferencia de arqueo:</span>
                <span
                  className={`font-black font-timer ${
                    difference >= 0 ? 'text-[#34D399]' : 'text-[#EF4444]'
                  }`}
                >
                  {difference >= 0 ? `+${formatMoney(difference)}` : `-${formatMoney(Math.abs(difference))}`}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1 border-t border-[#334155]">
                <span className="text-[#94A3B8]">Nuevo saldo tras recarga:</span>
                <span className="font-black text-[#34D399] font-timer">
                  {formatMoney(machine.current_balance + amountNum)}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Motivo o nota (opcional)
            </label>
            <input
              type="text"
              placeholder={mode === 'set_total' ? 'Ej: Conteo físico semanal de tolva' : 'Ej: Monedas de $500 para cambio'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#3B82F6]"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 text-white text-xs font-black shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Confirmar Ajuste'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 5. MODAL: VACIADO / CORTE DE GANANCIAS DE LA MÁQUINA
// ============================================================================
interface SlotEmptyProfitModalProps {
  machine: SlotMachine;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SlotEmptyProfitModal: React.FC<SlotEmptyProfitModalProps> = ({ machine, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [leaveFund, setLeaveFund] = useState(machine.initial_balance.toString());
  const [sendToCash, setSendToCash] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Quick action: withdraw everything except base initial fund
  const withdrawProfitOnly = () => {
    const profit = Math.max(0, machine.current_balance - machine.initial_balance);
    setAmount(profit.toString());
  };

  const withdrawAll = () => {
    setAmount(machine.current_balance.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Ingresa un monto válido para retirar');
      return;
    }

    if (amountNum > machine.current_balance) {
      setError(`No puedes retirar más de lo que tiene la máquina (${formatMoney(machine.current_balance)})`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await billiardService.emptySlotProfit({
        machineId: machine.id,
        amount: amountNum,
        sendToGeneralCash: sendToCash,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar el vaciado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-xl text-[#F59E0B]">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-[#F59E0B] tracking-wider">
              Corte / Vaciado de Ganancia
            </span>
            <h3 className="text-base font-black text-[#F8FAFC]">{machine.name}</h3>
            <p className="text-xs text-[#94A3B8]">Retira el dinero recaudado para el negocio</p>
          </div>
        </div>

        {/* Current status */}
        <div className="p-3 rounded-2xl bg-[#1E293B] border border-[#334155] mb-4 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Dinero actual en la máquina:</span>
            <span className="font-bold text-[#34D399] font-timer">
              {formatMoney(machine.current_balance)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Fondo base configurado:</span>
            <span className="font-bold text-[#F8FAFC] font-timer">
              {formatMoney(machine.initial_balance)}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#F8FAFC]">
                Monto a retirar ($) *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={withdrawProfitOnly}
                  className="text-[11px] font-bold text-[#F59E0B] hover:underline cursor-pointer font-timer"
                >
                  Solo Ganancia ({formatMoney(Math.max(0, machine.current_balance - machine.initial_balance))})
                </button>
                <span className="text-[#94A3B8]">|</span>
                <button
                  type="button"
                  onClick={withdrawAll}
                  className="text-[11px] font-bold text-[#94A3B8] hover:text-[#F8FAFC] hover:underline cursor-pointer font-timer"
                >
                  Todo
                </button>
              </div>
            </div>
            <input
              type="number"
              min="1"
              max={machine.current_balance}
              step="1000"
              required
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xl font-black text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#F59E0B]"
            />
          </div>

          <label className="flex items-center gap-2 p-3 rounded-2xl bg-[#1E293B] border border-[#334155] text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendToCash}
              onChange={(e) => setSendToCash(e.target.checked)}
              className="rounded text-[#10B981] focus:ring-0 cursor-pointer"
            />
            <span className="text-[#F8FAFC]">
              Registrar automáticamente como <strong>Ingreso en la Caja Diaria</strong> del billar
            </span>
          </label>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
              Notas adicionales (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Corte fin de semana, recolectado por administrador"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#F59E0B]"
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8]">Saldo que quedará en la tolva:</span>
            <span className="text-sm font-black text-[#F8FAFC] font-timer">
              {formatMoney(Math.max(0, machine.current_balance - (parseFloat(amount) || 0)))}
            </span>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 disabled:opacity-50 text-[#0F172A] text-xs font-black shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
            >
              <Wallet className="w-4 h-4" />
              <span>{isSubmitting ? 'Procesando...' : `Confirmar Vaciado (${formatMoney(parseFloat(amount) || 0)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 6. MODAL: EDITAR / CONFIGURAR MAQUINITA
// ============================================================================
interface EditSlotMachineModalProps {
  machine: SlotMachine;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditSlotMachineModal: React.FC<EditSlotMachineModalProps> = ({ machine, onClose, onSuccess }) => {
  const [name, setName] = useState(machine.name);
  const [code, setCode] = useState(machine.code || '');
  const [location, setLocation] = useState(machine.location || '');
  const [coinDenomination, setCoinDenomination] = useState(machine.coin_denomination?.toString() || '500');
  const [status, setStatus] = useState<SlotMachineStatus>(machine.status);
  const [notes, setNotes] = useState(machine.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await billiardService.updateSlotMachine(machine.id, {
        name: name.trim(),
        code: code.trim() || undefined,
        location: location.trim() || undefined,
        coin_denomination: parseFloat(coinDenomination) || 500,
        status,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`¿Seguro que deseas eliminar permanentemente la maquinita "${machine.name}"?`)) {
      try {
        await billiardService.deleteSlotMachine(machine.id);
        onSuccess?.();
        onClose();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-xl">
            ⚙️
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F8FAFC]">Editar Maquinita</h3>
            <p className="text-xs text-[#94A3B8]">{machine.name}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Nombre</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Código</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm font-timer text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Ubicación</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Estado</label>
            <div className="grid grid-cols-3 gap-2">
              {(['activa', 'mantenimiento', 'inactiva'] as SlotMachineStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`py-1.5 rounded-xl border text-xs font-bold capitalize transition cursor-pointer ${
                    status === st
                      ? st === 'activa'
                        ? 'bg-[#10B981] border-[#10B981] text-white'
                        : st === 'mantenimiento'
                        ? 'bg-[#F59E0B] border-[#F59E0B] text-[#0F172A]'
                        : 'bg-[#EF4444] border-[#EF4444] text-white'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Notas</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#334155]">
            <button
              type="button"
              onClick={handleDelete}
              className="py-2.5 px-3 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-bold transition cursor-pointer"
            >
              Eliminar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-black shadow-lg transition active:scale-98 cursor-pointer font-timer"
              >
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
