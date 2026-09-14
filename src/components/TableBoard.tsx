import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Layers,
  ShoppingBag,
  Wine,
  Plus,
  Users,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { db } from '../db';
import { BilliardTable, TableSession, CustomerTab } from '../types';
import { TableCard } from './TableCard';
import { StartGameModal } from './StartGameModal';
import { AddConsumptionModal } from './AddConsumptionModal';
import { CheckoutModal } from './CheckoutModal';
import { CreateTableModal } from './CreateTableModal';
import { DirectSaleModal } from './DirectSaleModal';
import { OpenCustomerTabModal } from './OpenCustomerTabModal';
import { CustomerTabConsumptionModal } from './CustomerTabConsumptionModal';
import { CustomerTabCheckoutModal } from './CustomerTabCheckoutModal';
import { CustomerTabCard } from './CustomerTabCard';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';

export const TableBoard: React.FC = () => {
  const tables =
    useLiveQuery(
      () =>
        db.billiard_tables
          .toArray()
          .then((arr) => arr.filter((t) => Boolean(t.is_active)).sort((a, b) => a.number - b.number)),
      []
    ) || [];

  // Open customer tabs (clientes consumiendo que pagan al final)
  const openCustomerTabs =
    useLiveQuery(
      () =>
        db.customer_tabs
          .where('status')
          .equals('abierta')
          .reverse()
          .sortBy('created_at'),
      []
    ) || [];

  const totalOpenTabsAmount = openCustomerTabs.reduce(
    (acc, tab) => acc + (tab.total_amount || 0),
    0
  );

  // View switch: 'tables' | 'tabs' | 'all'
  const [activeBoardView, setActiveBoardView] = useState<'tables' | 'tabs' | 'all'>('tables');

  // Table session modals
  const [selectedTableForStart, setSelectedTableForStart] = useState<BilliardTable | null>(null);
  const [activeConsumptionSession, setActiveConsumptionSession] = useState<{
    session: TableSession;
    tableNumber: number;
  } | null>(null);
  const [activeCheckoutSession, setActiveCheckoutSession] = useState<{
    session: TableSession;
    tableNumber: number;
  } | null>(null);

  // Modals for Table Management & Direct Sales
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showDirectSaleModal, setShowDirectSaleModal] = useState(false);
  const [showSelectTableModal, setShowSelectTableModal] = useState(false);

  // Customer Tab Modals
  const [showOpenCustomerTabModal, setShowOpenCustomerTabModal] = useState(false);
  const [activeTabForConsumption, setActiveTabForConsumption] = useState<CustomerTab | null>(null);
  const [activeTabForCheckout, setActiveTabForCheckout] = useState<CustomerTab | null>(null);

  const [tableFilter, setTableFilter] = useState<'all' | 'active' | 'free'>('all');

  const filteredTables = tables.filter((t) => {
    if (tableFilter === 'active') return t.status !== 'libre';
    if (tableFilter === 'free') return t.status === 'libre';
    return true;
  });

  const activeCount = tables.filter((t) => t.status !== 'libre').length;
  const freeCount = tables.filter((t) => t.status === 'libre').length;

  const handleStartSession = async (
    tableId: string,
    mode: 'libre' | 'prepago' | 'consumo',
    minutes?: number
  ) => {
    await billiardService.startSession(tableId, mode, minutes);
    setSelectedTableForStart(null);
  };

  // Quick action: Pick a table to add consumption
  const handleSelectTableForConsumption = async (table: BilliardTable) => {
    setShowSelectTableModal(false);
    if (table.current_session_id) {
      const session = await db.sessions.get(table.current_session_id);
      if (session) {
        setActiveConsumptionSession({ session, tableNumber: table.number });
        return;
      }
    }

    // If table is free, initiate a consumption session and open the modal
    try {
      const newSession = await billiardService.startSession(table.id, 'consumo');
      setActiveConsumptionSession({ session: newSession, tableNumber: table.number });
    } catch (err: any) {
      alert(err?.message || 'Error al abrir consumos en mesa');
    }
  };

  const handleCustomerTabCreated = async (tabId: string) => {
    setShowOpenCustomerTabModal(false);
    const tab = await db.customer_tabs.get(tabId);
    if (tab) {
      setActiveTabForConsumption(tab);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar: Add Customer Tab, Add Table, Direct Sale, Quick Table Consumption */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* New Customer Tab Button (Paga al final) */}
          <button
            type="button"
            onClick={() => setShowOpenCustomerTabModal(true)}
            className="py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-md"
          >
            <Users className="w-4 h-4 text-white" />
            <span>+ Abrir Cuenta en Barra (Paga al salir)</span>
          </button>

          {/* Add Table Button */}
          <button
            type="button"
            onClick={() => setShowCreateTableModal(true)}
            className="py-2.5 px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#273449] text-[#F8FAFC] border border-[#334155] font-bold text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Agregar Mesa</span>
          </button>

          {/* Direct Sale / Bar Customer Button (Paga de una) */}
          <button
            type="button"
            onClick={() => setShowDirectSaleModal(true)}
            className="py-2.5 px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#273449] text-[#10B981] border border-[#334155] font-bold text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <Wine className="w-4 h-4" />
            <span>Venta Directa (Paga ya)</span>
          </button>
        </div>

        {/* Quick Select Table for Consumption */}
        <button
          type="button"
          onClick={() => setShowSelectTableModal(true)}
          className="py-2.5 px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#273449] text-[#F8FAFC] border border-[#334155] font-bold text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
        >
          <ShoppingBag className="w-4 h-4 text-[#10B981]" />
          <span>Consumo a Mesa</span>
        </button>
      </div>

      {/* Board View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-[#334155] pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveBoardView('tables')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activeBoardView === 'tables'
                ? 'bg-[#10B981] text-white shadow-md'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449] border border-[#334155]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Mesas del Salón ({tables.length})</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-[#EF4444] text-white text-[10px] font-black font-timer">
                {activeCount} en juego
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveBoardView('tabs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer relative ${
              activeBoardView === 'tabs'
                ? 'bg-[#3B82F6] text-white shadow-md'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449] border border-[#334155]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cuentas en Barra ({openCustomerTabs.length})</span>
            {openCustomerTabs.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[#34D399] border border-[#334155] text-[10px] font-black font-timer">
                {formatMoney(totalOpenTabsAmount)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveBoardView('all')}
            className={`hidden sm:flex px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold items-center gap-1.5 transition cursor-pointer ${
              activeBoardView === 'all'
                ? 'bg-[#273449] text-white border border-[#334155]'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449] border border-[#334155]'
            }`}
          >
            <span>Ver Todo el Salón</span>
          </button>
        </div>
      </div>

      {/* Alert Banner if on 'tables' view and there are active customer tabs */}
      {activeBoardView === 'tables' && openCustomerTabs.length > 0 && (
        <div
          onClick={() => setActiveBoardView('tabs')}
          className="p-3 rounded-xl bg-[#273449] border border-[#334155] hover:border-[#3B82F6] flex items-center justify-between gap-3 text-xs cursor-pointer transition shadow-md"
        >
          <div className="flex items-center gap-2 text-[#F8FAFC]">
            <Wine className="w-5 h-5 text-[#3B82F6]" />
            <div>
              <span className="font-bold text-[#F8FAFC] block">
                {openCustomerTabs.length} cuenta(s) en barra consumiendo (Pagan al salir)
              </span>
              <span className="text-[#94A3B8] block text-[11px]">
                Total acumulado por cobrar:{' '}
                <strong className="text-[#10B981] font-timer font-bold">{formatMoney(totalOpenTabsAmount)}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <span>Ver Cuentas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION: CUSTOMER TABS (Show if activeBoardView === 'tabs' or 'all') */}
      {(activeBoardView === 'tabs' || activeBoardView === 'all') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#F8FAFC] flex items-center gap-2">
                <span>🍹 Cuentas Abiertas de Clientes</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#1E293B] text-[#3B82F6] border border-[#334155] font-bold">
                  {openCustomerTabs.length} abiertas
                </span>
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Personas que están consumiendo en la barra o billar y pagarán al salir.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowOpenCustomerTabModal(true)}
              className="py-1.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold text-xs flex items-center gap-1 shadow-md transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nueva Cuenta</span>
            </button>
          </div>

          {openCustomerTabs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#273449] border border-dashed border-[#334155] text-center text-[#94A3B8] max-w-lg mx-auto">
              <span className="text-4xl block mb-2">🍹</span>
              <h3 className="font-bold text-[#F8FAFC] text-sm mb-1">
                No hay cuentas abiertas de clientes
              </h3>
              <p className="text-xs text-[#94A3B8] mb-4">
                Cuando alguien esté consumiendo en la barra y pague al salir, abre una cuenta aquí para ir anotando todo lo que consume.
              </p>
              <button
                type="button"
                onClick={() => setShowOpenCustomerTabModal(true)}
                className="py-2 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir primera cuenta de cliente</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {openCustomerTabs.map((tab) => (
                <CustomerTabCard
                  key={tab.id}
                  tab={tab}
                  onOpenConsumption={(t) => setActiveTabForConsumption(t)}
                  onOpenCheckout={(t) => setActiveTabForCheckout(t)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION: BILLIARD TABLES (Show if activeBoardView === 'tables' || 'all') */}
      {(activeBoardView === 'tables' || activeBoardView === 'all') && (
        <div className="space-y-4">
          {activeBoardView === 'all' && (
            <div className="pt-4 border-t border-[#334155]">
              <h2 className="text-lg font-black text-[#F8FAFC] flex items-center gap-2 mb-3">
                <span>Mesas de Billar</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#1E293B] text-[#10B981] border border-[#334155] font-bold font-timer">
                  {tables.length} mesas
                </span>
              </h2>
            </div>
          )}

          {/* Overview Metric Cards for Tables */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div
              onClick={() => setTableFilter('all')}
              className={`p-3 sm:p-4 rounded-xl border transition cursor-pointer ${
                tableFilter === 'all'
                  ? 'bg-[#273449] border-[#3B82F6] shadow-md ring-1 ring-[#3B82F6]'
                  : 'bg-[#273449] border-[#334155] hover:border-[#475569]'
              }`}
            >
              <div className="flex items-center gap-2 text-[#94A3B8] text-xs font-semibold">
                <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Total Mesas</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#F8FAFC] mt-1 font-timer">
                {tables.length}
              </div>
            </div>

            <div
              onClick={() => setTableFilter('active')}
              className={`p-3 sm:p-4 rounded-xl border transition cursor-pointer ${
                tableFilter === 'active'
                  ? 'bg-[#273449] border-[#EF4444] shadow-md ring-1 ring-[#EF4444]'
                  : 'bg-[#273449] border-[#334155] hover:border-[#475569]'
              }`}
            >
              <div className="flex items-center gap-2 text-[#EF4444] text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                <span>En Juego</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#EF4444] mt-1 font-timer">
                {activeCount}
              </div>
            </div>

            <div
              onClick={() => setTableFilter('free')}
              className={`p-3 sm:p-4 rounded-xl border transition cursor-pointer ${
                tableFilter === 'free'
                  ? 'bg-[#273449] border-[#10B981] shadow-md ring-1 ring-[#10B981]'
                  : 'bg-[#273449] border-[#334155] hover:border-[#475569]'
              }`}
            >
              <div className="flex items-center gap-2 text-[#10B981] text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>Disponibles</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#10B981] mt-1 font-timer">
                {freeCount}
              </div>
            </div>
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onOpenStart={(tbl) => setSelectedTableForStart(tbl)}
                onOpenConsumption={(sess, num) =>
                  setActiveConsumptionSession({ session: sess, tableNumber: num })
                }
                onOpenCheckout={(sess, num) =>
                  setActiveCheckoutSession({ session: sess, tableNumber: num })
                }
              />
            ))}
          </div>

          {filteredTables.length === 0 && (
            <div className="p-10 rounded-2xl bg-[#273449] border border-[#334155] text-center text-[#94A3B8]">
              <p className="font-semibold text-[#F8FAFC] mb-2">
                No hay mesas con el filtro seleccionado.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateTableModal(true)}
                className="py-2 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar una mesa ahora</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Select Table for Consumption Modal */}
      {showSelectTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-5 shadow-2xl text-[#F8FAFC] relative">
            <button
              onClick={() => setShowSelectTableModal(false)}
              className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-lg font-black text-[#F8FAFC] mb-1">
              Seleccionar Mesa para Consumo
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Toca la mesa a la que deseas agregarle bebidas o consumos
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {tables.map((table) => {
                const isBusy = table.status !== 'libre';
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => handleSelectTableForConsumption(table)}
                    className={`p-3 rounded-xl border text-left transition active:scale-95 cursor-pointer ${
                      isBusy
                        ? 'bg-[#1E293B] hover:bg-[#1E293B]/80 border-[#334155]'
                        : 'bg-[#1E293B] hover:bg-[#1E293B]/80 border-[#10B981]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="w-7 h-7 rounded-lg bg-[#273449] text-[#F8FAFC] font-black text-xs flex items-center justify-center border border-[#334155] font-timer">
                        {table.number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isBusy
                            ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40'
                            : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40'
                        }`}
                      >
                        {table.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-[#F8FAFC]">{table.name}</div>
                    <div className="text-[10px] text-[#94A3B8] mt-0.5">
                      {isBusy ? 'Agregar consumos' : 'Abrir consumo'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Customer Tab Modals */}
      {showOpenCustomerTabModal && (
        <OpenCustomerTabModal
          onClose={() => setShowOpenCustomerTabModal(false)}
          onSuccess={handleCustomerTabCreated}
        />
      )}

      {activeTabForConsumption && (
        <CustomerTabConsumptionModal
          tab={activeTabForConsumption}
          onClose={() => setActiveTabForConsumption(null)}
          onOpenCheckout={() => {
            const currentTab = activeTabForConsumption;
            setActiveTabForConsumption(null);
            setActiveTabForCheckout(currentTab);
          }}
        />
      )}

      {activeTabForCheckout && (
        <CustomerTabCheckoutModal
          tab={activeTabForCheckout}
          onClose={() => setActiveTabForCheckout(null)}
          onCompleted={() => setActiveTabForCheckout(null)}
        />
      )}

      {/* Create Table Modal */}
      {showCreateTableModal && (
        <CreateTableModal
          existingTables={tables}
          onClose={() => setShowCreateTableModal(false)}
          onCreated={() => setShowCreateTableModal(false)}
        />
      )}

      {/* Direct Sale / Bar Customer Modal */}
      {showDirectSaleModal && (
        <DirectSaleModal
          onClose={() => setShowDirectSaleModal(false)}
          onSuccess={() => setShowDirectSaleModal(false)}
        />
      )}

      {/* Start Game Modal */}
      {selectedTableForStart && (
        <StartGameModal
          table={selectedTableForStart}
          onClose={() => setSelectedTableForStart(null)}
          onStart={handleStartSession}
        />
      )}

      {/* Add Consumption Modal for Table */}
      {activeConsumptionSession && (
        <AddConsumptionModal
          session={activeConsumptionSession.session}
          tableNumber={activeConsumptionSession.tableNumber}
          onClose={() => setActiveConsumptionSession(null)}
        />
      )}

      {/* Checkout / Finalize Modal for Table */}
      {activeCheckoutSession && (
        <CheckoutModal
          session={activeCheckoutSession.session}
          tableNumber={activeCheckoutSession.tableNumber}
          onClose={() => setActiveCheckoutSession(null)}
          onCompleted={() => setActiveCheckoutSession(null)}
        />
      )}
    </div>
  );
};
