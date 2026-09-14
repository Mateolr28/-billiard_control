import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Coins,
  Trophy,
  Plus,
  Sliders,
  TrendingDown,
  TrendingUp,
  History,
  Search,
  Filter,
  DollarSign,
  Wallet,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import { db } from '../db';
import { SlotMachine, SlotMachineMovement, SlotMovementType } from '../types';
import { formatMoney } from '../utils/billing';
import {
  AddSlotMachineModal,
  SlotPayoutModal,
  SlotIncomeModal,
  SlotBalanceModal,
  SlotEmptyProfitModal,
  EditSlotMachineModal,
} from './SlotModals';

export const SlotMachinesModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'machines' | 'history'>('machines');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activa' | 'mantenimiento' | 'inactiva'>('all');
  const [historyMachineFilter, setHistoryMachineFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMachineForPayout, setSelectedMachineForPayout] = useState<SlotMachine | null>(null);
  const [selectedMachineForIncome, setSelectedMachineForIncome] = useState<SlotMachine | null>(null);
  const [selectedMachineForBalance, setSelectedMachineForBalance] = useState<SlotMachine | null>(null);
  const [selectedMachineForEmpty, setSelectedMachineForEmpty] = useState<SlotMachine | null>(null);
  const [selectedMachineForEdit, setSelectedMachineForEdit] = useState<SlotMachine | null>(null);

  // Live queries
  const machines = useLiveQuery(() => db.slot_machines.toArray(), []) || [];
  const movements = useLiveQuery(() => db.slot_machine_movements.reverse().toArray(), []) || [];

  // Summary Metrics
  const activeMachines = machines.filter((m) => m.status === 'activa');
  const totalMoneyInMachines = machines.reduce((acc, m) => acc + (m.current_balance || 0), 0);
  const totalPaidOutToPlayers = machines.reduce((acc, m) => acc + (m.total_paid_out || 0), 0);
  const totalInAllMachines = machines.reduce((acc, m) => acc + (m.total_in || 0), 0);
  const netClubProfit = totalInAllMachines - totalPaidOutToPlayers;

  // Filtered machines
  const filteredMachines = machines.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.code && m.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.location && m.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered movements for history
  const filteredMovements = movements.filter((mov) => {
    const matchesMachine = historyMachineFilter === 'all' || mov.machine_id === historyMachineFilter;
    const matchesType = historyTypeFilter === 'all' || mov.type === historyTypeFilter;
    return matchesMachine && matchesType;
  });

  // Helper for movement labels and badges
  const getMovementBadge = (type: SlotMovementType) => {
    switch (type) {
      case 'premio_jugador':
        return {
          label: 'Premio Sacado por Jugador',
          bg: 'bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]',
          icon: <Trophy className="w-3.5 h-3.5" />,
          sign: '-',
          color: 'text-[#EF4444]',
        };
      case 'ingreso_jugadas':
        return {
          label: 'Recaudación de Jugadas',
          bg: 'bg-[#10B981]/15 border-[#10B981]/30 text-[#34D399]',
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          sign: '+',
          color: 'text-[#34D399]',
        };
      case 'fondo_inicial':
        return {
          label: 'Fondo Inicial',
          bg: 'bg-[#3B82F6]/15 border-[#3B82F6]/30 text-[#60A5FA]',
          icon: <Coins className="w-3.5 h-3.5" />,
          sign: '',
          color: 'text-[#60A5FA]',
        };
      case 'recarga_fondo':
        return {
          label: 'Recarga de Fondo',
          bg: 'bg-[#3B82F6]/15 border-[#3B82F6]/30 text-[#60A5FA]',
          icon: <Plus className="w-3.5 h-3.5" />,
          sign: '+',
          color: 'text-[#60A5FA]',
        };
      case 'vaciado_ganancia':
        return {
          label: 'Vaciado / Corte Negocio',
          bg: 'bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]',
          icon: <Wallet className="w-3.5 h-3.5" />,
          sign: '-',
          color: 'text-[#F59E0B]',
        };
      case 'ajuste_arqueo':
      default:
        return {
          label: 'Arqueo de Tolva',
          bg: 'bg-[#94A3B8]/15 border-[#94A3B8]/30 text-[#94A3B8]',
          icon: <Sliders className="w-3.5 h-3.5" />,
          sign: '',
          color: 'text-[#F8FAFC]',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-[#273449] border border-[#334155] text-xl">🎰</span>
            <span>Maquinitas Tragamonedas</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Control de fondos, dinero en tolva y registro de premios sacados por jugadores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#10B981] hover:bg-[#10B981]/90 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition active:scale-98 cursor-pointer font-timer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Maquinita</span>
          </button>
        </div>
      </div>

      {/* Global Financial Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Dinero en Máquinas */}
        <div className="bg-[#273449] border border-[#334155] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-xs font-semibold">Dinero en Máquinas</span>
            <Coins className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#34D399] font-timer">
            {formatMoney(totalMoneyInMachines)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Suma en tolvas ({machines.length} {machines.length === 1 ? 'máquina' : 'máquinas'})
          </p>
        </div>

        {/* Dinero Sacado por Jugadores */}
        <div className="bg-[#273449] border border-[#334155] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-xs font-semibold">Sacado por Jugadores</span>
            <Trophy className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#EF4444] font-timer">
            {formatMoney(totalPaidOutToPlayers)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Premios y ganancias de clientes
          </p>
        </div>

        {/* Total Recaudado / Ingresos */}
        <div className="bg-[#273449] border border-[#334155] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-xs font-semibold">Total Ingresado / Jugado</span>
            <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#60A5FA] font-timer">
            {formatMoney(totalInAllMachines)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Fondos iniciales + recaudación
          </p>
        </div>

        {/* Ganancia Neta del Billar */}
        <div className="bg-[#273449] border border-[#334155] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#94A3B8] mb-1">
            <span className="text-xs font-semibold">Ganancia Neta Local</span>
            <Wallet className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div
            className={`text-xl sm:text-2xl font-black font-timer ${
              netClubProfit >= 0 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
            }`}
          >
            {formatMoney(netClubProfit)}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Ingresos menos premios pagados
          </p>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1E293B] p-2 rounded-2xl border border-[#334155]">
        {/* Module Sub-tabs */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('machines')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'machines'
                ? 'bg-[#10B981] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Mis Máquinas ({machines.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#10B981] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Movimientos ({movements.length})</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        {activeTab === 'machines' && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Buscar máquina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#273449] border border-[#334155] rounded-xl text-xs text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#273449] border border-[#334155] text-xs font-semibold text-[#F8FAFC] rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#10B981] cursor-pointer"
            >
              <option value="all">Todas</option>
              <option value="activa">Activas</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="inactiva">Inactivas</option>
            </select>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: MÁQUINAS (TARJETAS) */}
      {/* ==================================================================== */}
      {activeTab === 'machines' && (
        <div>
          {filteredMachines.length === 0 ? (
            <div className="bg-[#273449] border border-[#334155] rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-[#1E293B] border border-[#334155] flex items-center justify-center mx-auto text-3xl mb-4">
                🎰
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC] mb-1">
                {machines.length === 0
                  ? 'No hay maquinitas registradas todavía'
                  : 'No se encontraron máquinas con los filtros actuales'}
              </h3>
              <p className="text-xs text-[#94A3B8] mb-6">
                {machines.length === 0
                  ? 'Agrega tus tragamonedas para llevar el control exacto de cuánto dinero tienen y cuánto dinero sacan los clientes.'
                  : 'Prueba cambiando el término de búsqueda o el estado seleccionado.'}
              </p>
              {machines.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition active:scale-98 cursor-pointer inline-flex items-center gap-2 font-timer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Primera Maquinita</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {filteredMachines.map((machine) => {
                const machineProfit = (machine.total_in || 0) - (machine.total_paid_out || 0);

                return (
                  <div
                    key={machine.id}
                    className="bg-[#273449] border border-[#334155] rounded-3xl p-5 shadow-lg flex flex-col justify-between hover:border-[#10B981]/50 transition duration-200"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-xl">
                            🎰
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-base font-black text-[#F8FAFC] leading-tight">
                                {machine.name}
                              </h3>
                              {machine.code && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#1E293B] border border-[#334155] text-[10px] font-mono text-[#94A3B8] font-bold">
                                  {machine.code}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#94A3B8]">
                              {machine.location || 'Ubicación general'}
                              {machine.coin_denomination ? ` • Ficha $${machine.coin_denomination}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge & Settings */}
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize ${
                              machine.status === 'activa'
                                ? 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30'
                                : machine.status === 'mantenimiento'
                                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                                : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                            }`}
                          >
                            {machine.status}
                          </span>
                          <button
                            onClick={() => setSelectedMachineForEdit(machine)}
                            className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
                            title="Configurar / Editar máquina"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Cash in Machine Display (Tolva / Saldo Actual) */}
                      <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#334155] mb-4">
                        <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-[#10B981]" />
                            Dinero Actual en la Máquina:
                          </span>
                          <button
                            onClick={() => setSelectedMachineForBalance(machine)}
                            className="text-[10px] text-[#3B82F6] hover:underline font-bold cursor-pointer"
                            title="Ajustar o contar dinero físico"
                          >
                            Arqueo / Recarga
                          </button>
                        </div>
                        <div className="text-2xl font-black text-[#34D399] font-timer tracking-tight">
                          {formatMoney(machine.current_balance)}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] mt-1 flex justify-between">
                          <span>Fondo base: {formatMoney(machine.initial_balance)}</span>
                          <span className="text-[#34D399] font-bold font-timer">
                            {machine.current_balance >= machine.initial_balance ? 'Con superávit' : 'Bajo de fondo'}
                          </span>
                        </div>
                      </div>

                      {/* Payout & Income Breakdown */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {/* Sacado por Jugadores */}
                        <div className="p-2.5 rounded-xl bg-[#1E293B]/70 border border-[#334155]">
                          <span className="text-[10px] font-bold text-[#EF4444] flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Sacado por Jugadores
                          </span>
                          <div className="text-sm font-black text-[#EF4444] font-timer mt-0.5">
                            {formatMoney(machine.total_paid_out)}
                          </div>
                          <span className="text-[9px] text-[#94A3B8]">Premios entregados</span>
                        </div>

                        {/* Ganancia Neta Máquina */}
                        <div className="p-2.5 rounded-xl bg-[#1E293B]/70 border border-[#334155]">
                          <span className="text-[10px] font-bold text-[#F59E0B] flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            Ganancia Neta
                          </span>
                          <div
                            className={`text-sm font-black font-timer mt-0.5 ${
                              machineProfit >= 0 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                            }`}
                          >
                            {formatMoney(machineProfit)}
                          </div>
                          <span className="text-[9px] text-[#94A3B8]">Beneficio para el local</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-[#334155]">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Registrar Premio / Retiro */}
                        <button
                          onClick={() => setSelectedMachineForPayout(machine)}
                          className="w-full py-2 px-2.5 rounded-xl bg-[#EF4444] hover:bg-[#EF4444]/90 text-white font-black text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
                          title="Registrar dinero sacado o ganado por jugador"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>- Sacó Jugador</span>
                        </button>

                        {/* Registrar Recaudación / Ingreso */}
                        <button
                          onClick={() => setSelectedMachineForIncome(machine)}
                          className="w-full py-2 px-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-black text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 font-timer"
                          title="Registrar monedas jugadas / recaudación"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+ Recaudación</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Arqueo / Ajuste */}
                        <button
                          onClick={() => setSelectedMachineForBalance(machine)}
                          className="w-full py-1.5 px-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Arqueo Tolva</span>
                        </button>

                        {/* Vaciado de Ganancia */}
                        <button
                          onClick={() => setSelectedMachineForEmpty(machine)}
                          className="w-full py-1.5 px-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F59E0B] hover:text-[#F59E0B] font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Wallet className="w-3 h-3" />
                          <span>Vaciado / Corte</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: HISTORIAL DE MOVIMIENTOS */}
      {/* ==================================================================== */}
      {activeTab === 'history' && (
        <div className="bg-[#273449] border border-[#334155] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#334155]">
            <div>
              <h3 className="text-base font-bold text-[#F8FAFC]">Historial de Movimientos de Máquinas</h3>
              <p className="text-xs text-[#94A3B8]">
                Registro cronológico de premios sacados por jugadores, recaudaciones, fondos y vaciados
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={historyMachineFilter}
                onChange={(e) => setHistoryMachineFilter(e.target.value)}
                className="bg-[#1E293B] border border-[#334155] text-xs font-semibold text-[#F8FAFC] rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#10B981] cursor-pointer"
              >
                <option value="all">Todas las máquinas</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="bg-[#1E293B] border border-[#334155] text-xs font-semibold text-[#F8FAFC] rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#10B981] cursor-pointer"
              >
                <option value="all">Todos los movimientos</option>
                <option value="premio_jugador">Premios a jugadores (Sacados)</option>
                <option value="ingreso_jugadas">Recaudaciones (Monedas)</option>
                <option value="fondo_inicial">Fondos iniciales</option>
                <option value="recarga_fondo">Recargas de fondo</option>
                <option value="vaciado_ganancia">Vaciados de ganancia</option>
                <option value="ajuste_arqueo">Arqueos de tolva</option>
              </select>
            </div>
          </div>

          {filteredMovements.length === 0 ? (
            <div className="py-12 text-center text-[#94A3B8]">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No se encontraron movimientos registrados</p>
              <p className="text-xs">Los premios y recaudaciones que registres aparecerán aquí en orden temporal.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#334155] text-[#94A3B8]">
                    <th className="py-2.5 px-3 font-semibold">Fecha & Hora</th>
                    <th className="py-2.5 px-3 font-semibold">Máquina</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold">Detalle / Jugador</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Monto</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Saldo Tolva</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {filteredMovements.map((mov) => {
                    const badge = getMovementBadge(mov.type);
                    const dateObj = new Date(mov.created_at);
                    const formattedDate = dateObj.toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                    });
                    const formattedTime = dateObj.toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <tr key={mov.id} className="hover:bg-[#1E293B]/40 transition">
                        <td className="py-3 px-3 font-timer text-[#94A3B8] whitespace-nowrap">
                          <span className="text-[#F8FAFC] font-semibold">{formattedDate}</span>{' '}
                          <span>{formattedTime}</span>
                        </td>

                        <td className="py-3 px-3 font-bold text-[#F8FAFC] whitespace-nowrap">
                          {mov.machine_name}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.bg}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-[#94A3B8]">
                          {mov.player_name && (
                            <span className="font-bold text-[#F8FAFC] mr-1.5">
                              Jugador: {mov.player_name} •
                            </span>
                          )}
                          <span>{mov.notes || '-'}</span>
                          {mov.sent_to_cash && (
                            <span className="ml-1.5 px-1 py-0.2 rounded bg-[#10B981]/15 text-[#34D399] text-[9px] font-bold">
                              En caja general
                            </span>
                          )}
                        </td>

                        <td className={`py-3 px-3 text-right font-black font-timer whitespace-nowrap ${badge.color}`}>
                          {badge.sign}
                          {formatMoney(mov.amount)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono text-[#94A3B8] whitespace-nowrap font-timer">
                          {formatMoney(mov.new_balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ACTIVE MODALS */}
      {/* ==================================================================== */}
      {showAddModal && (
        <AddSlotMachineModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}

      {selectedMachineForPayout && (
        <SlotPayoutModal
          machine={selectedMachineForPayout}
          onClose={() => setSelectedMachineForPayout(null)}
          onSuccess={() => setSelectedMachineForPayout(null)}
        />
      )}

      {selectedMachineForIncome && (
        <SlotIncomeModal
          machine={selectedMachineForIncome}
          onClose={() => setSelectedMachineForIncome(null)}
          onSuccess={() => setSelectedMachineForIncome(null)}
        />
      )}

      {selectedMachineForBalance && (
        <SlotBalanceModal
          machine={selectedMachineForBalance}
          onClose={() => setSelectedMachineForBalance(null)}
          onSuccess={() => setSelectedMachineForBalance(null)}
        />
      )}

      {selectedMachineForEmpty && (
        <SlotEmptyProfitModal
          machine={selectedMachineForEmpty}
          onClose={() => setSelectedMachineForEmpty(null)}
          onSuccess={() => setSelectedMachineForEmpty(null)}
        />
      )}

      {selectedMachineForEdit && (
        <EditSlotMachineModal
          machine={selectedMachineForEdit}
          onClose={() => setSelectedMachineForEdit(null)}
          onSuccess={() => setSelectedMachineForEdit(null)}
        />
      )}
    </div>
  );
};
