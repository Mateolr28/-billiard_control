import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Play,
  Pause,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Trash2,
  Coffee,
} from 'lucide-react';
import { BilliardTable, TableSession } from '../types';
import { db } from '../db';
import { billiardService } from '../services/billiardService';
import {
  calculateElapsedSeconds,
  calculatePrepagoRemainingSeconds,
  calculateTimeCost,
  formatDuration,
  formatMoney,
} from '../utils/billing';
import { soundService } from '../utils/sound';

interface TableCardProps {
  table: BilliardTable;
  onOpenStart: (table: BilliardTable) => void;
  onOpenConsumption: (session: TableSession, tableNumber: number) => void;
  onOpenCheckout: (session: TableSession, tableNumber: number) => void;
  onDeleteTable?: (tableId: string) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onOpenStart,
  onOpenConsumption,
  onOpenCheckout,
  onDeleteTable,
}) => {
  // Fetch session if active
  const session = useLiveQuery(
    async () => {
      if (!table.current_session_id) return null;
      return await db.sessions.get(table.current_session_id);
    },
    [table.current_session_id]
  );

  // Fetch consumptions
  const items =
    useLiveQuery(
      async () => {
        if (!session) return [];
        return await db.session_items.where('session_id').equals(session.id).toArray();
      },
      [session?.id]
    ) || [];

  // Live timer tick state
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [alarmPlayed, setAlarmPlayed] = useState<boolean>(false);

  useEffect(() => {
    // Tick every 1000ms only if session is active and not ended
    if (!session || session.status === 'ended') return;

    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.id, session?.status]);

  // Compute timing
  const isConsumoOnly = session?.mode === 'consumo' || table.status === 'solo_consumo';
  const isPrepago = session?.mode === 'prepago';
  const elapsedSeconds = session ? calculateElapsedSeconds(session, nowTimestamp) : 0;
  const remainingSeconds =
    session && isPrepago ? calculatePrepagoRemainingSeconds(session, nowTimestamp) : 0;
  const isTimeEnded = isPrepago && remainingSeconds <= 0;

  // Sound chime when prepago runs out
  useEffect(() => {
    if (isTimeEnded && !alarmPlayed && session?.status === 'active') {
      soundService.playTimeEndedAlarm();
      setAlarmPlayed(true);
    }
  }, [isTimeEnded, alarmPlayed, session?.status]);

  // Reset alarm flag if new session
  useEffect(() => {
    setAlarmPlayed(false);
  }, [session?.id]);

  // Monetary calculations
  const timeCost =
    session && !isConsumoOnly ? calculateTimeCost(elapsedSeconds, session.hourly_rate) : 0;
  const itemsCost = items.reduce((acc, curr) => acc + curr.total_price, 0);
  const totalCost = timeCost + itemsCost;

  const handleTogglePause = async () => {
    if (!table.current_session_id) return;
    try {
      if (table.status === 'pausada') {
        await billiardService.resumeSession(table.id);
      } else {
        await billiardService.pauseSession(table.id);
      }
    } catch (err: any) {
      alert(err?.message || 'Error al pausar/reanudar');
    }
  };

  const handleStartConsumptionOnly = async () => {
    try {
      const newSession = await billiardService.startSession(table.id, 'consumo');
      onOpenConsumption(newSession, table.number);
    } catch (err: any) {
      alert(err?.message || 'Error al iniciar consumo en mesa');
    }
  };

  const handleDeleteTable = async () => {
    if (table.status !== 'libre') {
      alert('No se puede quitar una mesa con partida o consumo activo. Finaliza la cuenta primero.');
      return;
    }

    if (window.confirm(`¿Estás seguro de eliminar la ${table.name}? Esta acción la quitará del tablero.`)) {
      try {
        await billiardService.deleteTable(table.id);
        onDeleteTable?.(table.id);
      } catch (err: any) {
        alert(err?.message || 'Error al eliminar mesa');
      }
    }
  };

  // Status visual badge styling
  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-[#1E293B] text-[#10B981] border border-[#10B981]/40">
      <span className="w-2 h-2 rounded-full bg-[#10B981]" />
      LIBRE
    </span>
  );

  let borderStyle = 'border-[#334155] bg-[#273449] hover:border-[#475569]';

  if (table.status === 'jugando') {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40">
        <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
        EN JUEGO
      </span>
    );
    borderStyle = 'border-[#EF4444]/40 bg-[#273449] shadow-lg shadow-[#EF4444]/10';
  } else if (table.status === 'solo_consumo') {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/40">
        <Coffee className="w-3.5 h-3.5" />
        BARRA / CONSUMO
      </span>
    );
    borderStyle = 'border-[#3B82F6]/40 bg-[#273449]';
  } else if (table.status === 'pausada') {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40">
        <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
        PAUSADA
      </span>
    );
    borderStyle = 'border-[#F59E0B]/40 bg-[#273449]';
  } else if (table.status === 'prepago') {
    if (isTimeEnded) {
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-[#EF4444] text-white border border-[#EF4444] shadow-md animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          TIEMPO CUMPLIDO
        </span>
      );
      borderStyle = 'border-[#EF4444] bg-[#273449] ring-1 ring-[#EF4444]/50';
    } else {
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/40">
          <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
          PREPAGO ({session?.prepago_minutes}M)
        </span>
      );
      borderStyle = 'border-[#3B82F6]/40 bg-[#273449]';
    }
  }

  return (
    <div
      className={`rounded-2xl border ${borderStyle} p-4 sm:p-5 transition-all duration-150 flex flex-col justify-between relative overflow-hidden`}
    >
      {/* Top Bar: Table Number Plate & Status & Remove Action */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            {/* Table Number Plate */}
            <div className="w-11 h-11 rounded-xl bg-[#1E293B] border border-[#334155] text-[#F8FAFC] flex items-center justify-center font-black text-lg shadow-inner">
              {table.number}
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-[#F8FAFC] tracking-tight uppercase">
                {table.name}
              </h3>
              <p className="text-[11px] text-[#94A3B8] font-medium">
                Tarifa hora: <span className="text-[#F8FAFC] font-semibold">{formatMoney(table.hourly_rate)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusBadge}
            {table.status === 'libre' && (
              <button
                type="button"
                onClick={handleDeleteTable}
                title="Quitar mesa del salón"
                className="p-1.5 rounded-lg bg-[#1E293B] text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#334155] border border-[#334155] transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Middle: Timer & Monetary Balance */}
        {table.status === 'libre' ? (
          <div className="py-7 sm:py-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1E293B] border border-[#334155] text-[#10B981] mb-2 shadow-inner">
              <span className="text-xl font-bold font-timer">#{table.number}</span>
            </div>
            <p className="text-sm font-bold text-[#F8FAFC]">Mesa Disponible</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Lista para abrir tiempo o despachar comanda</p>
          </div>
        ) : (
          <div className="py-3.5 space-y-3">
            {/* Live Timer Clock Display */}
            <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#334155] text-center relative overflow-hidden shadow-inner">
              <span className="text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase block mb-1">
                {isConsumoOnly
                  ? 'Consumos en Mesa (Sin Cronómetro)'
                  : isPrepago
                  ? 'Tiempo Restante'
                  : 'Cronómetro en Juego'}
              </span>

              <div
                className={`text-3xl sm:text-4xl font-black font-timer tracking-wider my-0.5 ${
                  isConsumoOnly
                    ? 'text-[#3B82F6] text-2xl sm:text-3xl'
                    : isTimeEnded
                    ? 'text-[#EF4444]'
                    : isPrepago
                    ? 'text-[#3B82F6]'
                    : table.status === 'pausada'
                    ? 'text-[#F59E0B]'
                    : 'text-[#F8FAFC]'
                }`}
              >
                {isConsumoOnly
                  ? `${items.length} consumos`
                  : isPrepago
                  ? formatDuration(remainingSeconds)
                  : formatDuration(elapsedSeconds)}
              </div>

              {!isConsumoOnly && isPrepago && (
                <div className="text-[11px] text-[#94A3B8] mt-1 font-timer">
                  Jugado: {formatDuration(elapsedSeconds)} / {session?.prepago_minutes} min
                </div>
              )}
            </div>

            {/* Financial Details (Scoreboard Tally) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#1E293B] border border-[#334155]">
                <span className="text-[#94A3B8] block text-[11px] font-medium">Tiempo de juego</span>
                <span className="font-bold text-sm text-[#F8FAFC] font-timer">
                  {formatMoney(timeCost)}
                </span>
              </div>

              <div
                onClick={() => session && onOpenConsumption(session, table.number)}
                className="p-2.5 rounded-xl bg-[#1E293B] border border-[#334155] hover:border-[#10B981] transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-[#94A3B8] text-[11px] font-medium">
                  <span>Consumos ({items.length})</span>
                  <ChevronRight className="w-3 h-3 text-[#10B981]" />
                </div>
                <span className="font-bold text-sm text-[#10B981] font-timer">
                  {items.length > 0 ? formatMoney(itemsCost) : '$0'}
                </span>
              </div>
            </div>

            {/* Total Balance Plate */}
            <div className="p-2.5 px-3 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-between">
              <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                Total Acumulado:
              </span>
              <span className="text-lg sm:text-xl font-black text-[#10B981] font-timer">
                {formatMoney(totalCost)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Touch Action Buttons */}
      <div className="pt-3 border-t border-[#334155]">
        {table.status === 'libre' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenStart(table)}
              className="py-2.5 px-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 active:scale-98 text-white font-black text-xs sm:text-sm border border-[#10B981] shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>INICIAR TIEMPO</span>
            </button>

            <button
              type="button"
              onClick={handleStartConsumptionOnly}
              className="py-2.5 px-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] active:scale-98 text-[#F8FAFC] border border-[#334155] font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>+ CONSUMO</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {/* Pause / Resume */}
            {!isConsumoOnly ? (
              <button
                type="button"
                onClick={handleTogglePause}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 active:scale-95 cursor-pointer ${
                  table.status === 'pausada'
                    ? 'bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0F172A] shadow-md font-black'
                    : 'bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155]'
                }`}
              >
                {table.status === 'pausada' ? (
                  <>
                    <Play className="w-4 h-4 fill-[#0F172A]" />
                    <span className="text-[11px]">REANUDAR</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    <span className="text-[11px]">PAUSAR</span>
                  </>
                )}
              </button>
            ) : (
              <div className="py-2.5 px-2 rounded-xl bg-[#1E293B] border border-[#334155] text-[10px] text-[#94A3B8] flex flex-col items-center justify-center text-center">
                <span>Sin reloj</span>
              </div>
            )}

            {/* Consumos */}
            <button
              type="button"
              onClick={() => session && onOpenConsumption(session, table.number)}
              className="py-2.5 px-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] active:scale-95 text-[#10B981] border border-[#334155] text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="text-[11px]">CONSUMO</span>
            </button>

            {/* Cobrar */}
            <button
              type="button"
              onClick={() => session && onOpenCheckout(session, table.number)}
              className="py-2.5 px-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 active:scale-95 text-white text-xs font-black border border-[#10B981] transition flex flex-col items-center justify-center gap-1 shadow-md cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="text-[11px]">COBRAR</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
