import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Layers,
  BookOpen,
  Wallet,
  Settings,
  Package,
  Volume2,
  VolumeX,
  PlusCircle,
  Wifi,
  WifiOff,
  Coins,
} from 'lucide-react';
import { db } from './db';
import { TableBoard } from './components/TableBoard';
import { InventoryModule } from './components/InventoryModule';
import { FiadosModule } from './components/FiadosModule';
import { CashModule } from './components/CashModule';
import { SettingsModule } from './components/SettingsModule';
import { SlotMachinesModule } from './components/SlotMachinesModule';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { PWAInstallButton } from './components/PWAInstallButton';
import { soundService } from './utils/sound';

type NavTab = 'tables' | 'inventory' | 'slots' | 'fiados' | 'cash' | 'settings';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('tables');
  const [soundEnabled, setSoundEnabled] = useState(soundService.isAudioEnabled());

  // Count indicators for navigation badges
  const activeTablesCount =
    useLiveQuery(
      () => db.billiard_tables.where('status').anyOf(['jugando', 'pausada', 'prepago', 'solo_consumo']).count(),
      []
    ) || 0;

  const openCustomerTabsCount =
    useLiveQuery(
      () => db.customer_tabs.where('status').equals('abierta').count(),
      []
    ) || 0;

  const totalDebtorsCount =
    useLiveQuery(() => db.customers.where('current_debt').above(0).count(), []) || 0;

  const slotMachinesCount =
    useLiveQuery(() => db.slot_machines.where('status').equals('activa').count(), []) || 0;

  // Stock alerts count (low stock or out of stock)
  const lowStockCount =
    useLiveQuery(
      () =>
        db.products
          .toArray()
          .then(
            (arr) =>
              arr.filter(
                (p) => Boolean(p.is_active) && p.stock <= (p.min_stock || 5)
              ).length
          ),
      []
    ) || 0;

  const toggleSound = () => {
    const nextState = !soundEnabled;
    soundService.setEnabled(nextState);
    setSoundEnabled(nextState);
    if (nextState) {
      soundService.playCashPing();
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col selection:bg-[#10B981] selection:text-white pb-20 md:pb-6">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#1E293B]/95 backdrop-blur-md border-b border-[#334155]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#273449] border border-[#334155] flex items-center justify-center text-white shadow-inner font-black text-sm">
              <span className="text-xl">🎱</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-[#F8FAFC] leading-tight tracking-tight flex items-center gap-2">
                <span className="tracking-wide">BILLAR & CLUB</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#273449] text-[#94A3B8] border border-[#334155] hidden sm:inline-block">
                  SISTEMA TPV
                </span>
              </h1>
              <p className="text-[11px] text-[#94A3B8] leading-none">
                Control de Mesas, Barra y Caja
              </p>
            </div>
          </div>

          {/* Top Actions & Badges */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Install PWA Button */}
            <PWAInstallButton />

            {/* Offline & Sync Status */}
            <SyncStatusBadge onOpenSettings={() => setCurrentTab('settings')} />

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                soundEnabled
                  ? 'bg-[#273449] text-[#10B981] border-[#334155]'
                  : 'bg-[#1E293B] text-[#94A3B8] border-[#334155]'
              }`}
              title={soundEnabled ? 'Efectos de sonido activados' : 'Sonidos silenciados'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Bar */}
        <div className="hidden md:block border-t border-[#334155] bg-[#1E293B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 py-1.5">
            <button
              onClick={() => setCurrentTab('tables')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'tables'
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Mesas & Barra</span>
              {activeTablesCount > 0 && (
                <span
                  title={`${activeTablesCount} mesas en juego`}
                  className="px-2 py-0.5 rounded-md bg-[#EF4444] text-white text-[10px] font-black font-timer"
                >
                  {activeTablesCount} juego
                </span>
              )}
              {openCustomerTabsCount > 0 && (
                <span
                  title={`${openCustomerTabsCount} comandas abiertas en barra`}
                  className="px-2 py-0.5 rounded-md bg-[#3B82F6] text-white text-[10px] font-black font-timer"
                >
                  {openCustomerTabsCount} barra
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'inventory'
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Inventario & Stock</span>
              {lowStockCount > 0 && (
                <span
                  title={`${lowStockCount} productos con stock bajo o agotados`}
                  className="px-1.5 py-0.5 rounded-md bg-[#EF4444] text-white text-[10px] font-black"
                >
                  {lowStockCount} alerta
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('slots')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'slots'
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Tragamonedas</span>
              {slotMachinesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#1E293B] border border-[#334155] text-[#34D399] text-[10px] font-bold font-timer">
                  {slotMachinesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('fiados')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'fiados'
                  ? 'bg-[#F59E0B] text-[#0F172A] shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Libreta de Fiados</span>
              {totalDebtorsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#EF4444] text-white text-[10px] font-black font-timer">
                  {totalDebtorsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('cash')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'cash'
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Caja & Cierre</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#273449]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-20 md:pb-6">
        {currentTab === 'tables' && <TableBoard />}
        {currentTab === 'inventory' && <InventoryModule />}
        {currentTab === 'slots' && <SlotMachinesModule />}
        {currentTab === 'fiados' && <FiadosModule />}
        {currentTab === 'cash' && <CashModule />}
        {currentTab === 'settings' && <SettingsModule />}
      </main>

      {/* Mobile Sticky Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1E293B]/95 backdrop-blur-md border-t border-[#334155] px-2 py-2 flex justify-around items-center">
        <button
          onClick={() => setCurrentTab('tables')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'tables' ? 'text-[#10B981] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <div className="relative">
            <Layers className="w-4 h-4" />
            {(activeTablesCount > 0 || openCustomerTabsCount > 0) && (
              <span
                className={`absolute -top-1 -right-2 min-w-3.5 h-3.5 px-0.5 rounded-md text-[8px] font-black flex items-center justify-center text-white ${
                  openCustomerTabsCount > 0 ? 'bg-[#3B82F6]' : 'bg-[#EF4444]'
                }`}
              >
                {activeTablesCount + openCustomerTabsCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Mesas</span>
        </button>

        <button
          onClick={() => setCurrentTab('inventory')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'inventory' ? 'text-[#10B981] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <div className="relative">
            <Package className="w-4 h-4" />
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#EF4444] border border-[#1E293B]" />
            )}
          </div>
          <span className="text-[10px]">Stock</span>
        </button>

        <button
          onClick={() => setCurrentTab('slots')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'slots' ? 'text-[#10B981] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <div className="relative">
            <Coins className="w-4 h-4" />
            {slotMachinesCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-3.5 h-3.5 px-0.5 rounded-md bg-[#10B981] text-white text-[8px] font-black flex items-center justify-center">
                {slotMachinesCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Tragamonedas</span>
        </button>

        <button
          onClick={() => setCurrentTab('fiados')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'fiados' ? 'text-[#F59E0B] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[10px]">Fiados</span>
          {totalDebtorsCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-[#EF4444]" />
          )}
        </button>

        <button
          onClick={() => setCurrentTab('cash')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer ${
            currentTab === 'cash' ? 'text-[#10B981] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[10px]">Caja</span>
        </button>

        <button
          onClick={() => setCurrentTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer ${
            currentTab === 'settings' ? 'text-[#10B981] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[10px]">Ajustes</span>
        </button>
      </nav>
    </div>
  );
}
