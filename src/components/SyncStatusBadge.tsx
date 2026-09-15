import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Database, ExternalLink } from 'lucide-react';
import { syncService, SyncState } from '../services/syncService';

interface SyncStatusBadgeProps {
  onOpenSettings?: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ onOpenSettings }) => {
  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!showModal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showModal]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const result = await Promise.race([
        syncService.processSyncQueue(),
        new Promise<{ success: false; synced: number; error: string }>((resolve) => {
          window.setTimeout(
            () => resolve({ success: false, synced: 0, error: 'La sincronización está tardando. Puedes cerrar esta ventana y continuará en segundo plano.' }),
            15000
          );
        }),
      ]);
      if (result.success) {
        setFeedback(`Sincronizados ${result.synced} registros.`);
      } else {
        setFeedback(result.error || 'Error al sincronizar');
      }
    } catch (err: any) {
      setFeedback(err?.message || 'Error desconocido');
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine badge appearance
  let badgeColor = 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30';
  let dotColor = 'bg-[#10B981]';
  let label = 'Sincronizado';
  let icon = <CheckCircle2 className="w-3.5 h-3.5" />;

  if (!syncState.isOnline) {
    badgeColor = 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
    dotColor = 'bg-[#F59E0B]';
    label = syncState.pendingCount > 0 ? `${syncState.pendingCount} pendientes (offline)` : 'Modo Offline';
    icon = <CloudOff className="w-3.5 h-3.5" />;
  } else if (syncState.status === 'error') {
    badgeColor = 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30';
    dotColor = 'bg-[#EF4444]';
    label = 'Error de sinc';
    icon = <AlertCircle className="w-3.5 h-3.5" />;
  } else if (syncState.status === 'pending' || syncState.pendingCount > 0) {
    badgeColor = 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
    dotColor = 'bg-[#F59E0B] animate-pulse';
    label = `${syncState.pendingCount} por sincronizar`;
    icon = <Cloud className="w-3.5 h-3.5" />;
  } else if (!syncState.isConfigured) {
    badgeColor = 'bg-[#10B981]/10 text-[#34D399] border-[#10B981]/20';
    dotColor = 'bg-[#10B981]';
    label = 'Local (IndexedDB)';
    icon = <Database className="w-3.5 h-3.5" />;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition hover:opacity-90 active:scale-95 cursor-pointer ${badgeColor}`}
        title="Ver estado de conexión y sincronización"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{syncState.pendingCount > 0 ? `${syncState.pendingCount} pend.` : 'Sync'}</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/75 backdrop-blur-xs p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowModal(false);
          }}
          role="presentation"
        >
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-[#273449] border border-[#334155] p-4 sm:p-6 shadow-2xl text-[#F8FAFC] relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#334155]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#1E293B] text-[#10B981] border border-[#334155]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#F8FAFC]">Estado de Sincronización</h3>
                  <p className="text-xs text-[#94A3B8]">Almacenamiento Offline & Supabase</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                type="button"
                aria-label="Cerrar estado de sincronización"
                className="text-[#94A3B8] hover:text-[#F8FAFC] p-2 rounded-lg hover:bg-[#1E293B] text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {/* Network Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                <span className="text-[#94A3B8]">Conexión a Internet:</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold text-xs px-2 py-0.5 rounded-full ${
                    syncState.isOnline
                      ? 'bg-[#10B981]/20 text-[#34D399]'
                      : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${syncState.isOnline ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                  {syncState.isOnline ? 'En línea' : 'Sin conexión'}
                </span>
              </div>

              {/* IndexedDB Local Engine */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                <span className="text-[#94A3B8]">Base Local (IndexedDB):</span>
                <span className="font-semibold text-xs px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#34D399]">
                  🟢 Operativa 100% Offline
                </span>
              </div>

              {/* Supabase Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                <span className="text-[#94A3B8]">Nube Supabase:</span>
                <span
                  className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                    syncState.isConfigured
                      ? 'bg-[#3B82F6]/20 text-[#3B82F6]'
                      : 'bg-[#334155] text-[#94A3B8]'
                  }`}
                >
                  {syncState.isConfigured ? 'Conectado' : 'Sin credenciales (Modo local)'}
                </span>
              </div>

              {/* Pending Queue */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                <span className="text-[#94A3B8]">Cambios pendientes en cola:</span>
                <span
                  className={`font-bold text-xs px-2.5 py-0.5 rounded-full font-timer ${
                    syncState.pendingCount > 0
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'bg-[#10B981]/20 text-[#34D399]'
                  }`}
                >
                  {syncState.pendingCount === 0 ? '0 (Al día)' : `${syncState.pendingCount} operaciones`}
                </span>
              </div>

              {syncState.lastSyncTime && (
                <div className="text-xs text-[#94A3B8] text-right font-timer">
                  Última sincronización: {syncState.lastSyncTime}
                </div>
              )}

              {syncState.errorMessage && (
                <div className="p-2.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs">
                  {syncState.errorMessage}
                </div>
              )}

              {feedback && (
                <div className="p-2.5 rounded-lg bg-[#1E293B] border border-[#334155] text-[#34D399] text-xs text-center">
                  {feedback}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-[#334155] flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing || !syncState.isOnline}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer font-timer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
              </button>

              {onOpenSettings && (
                <button
                  onClick={() => {
                    setShowModal(false);
                    onOpenSettings();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] text-xs font-semibold border border-[#334155] transition cursor-pointer"
                >
                  <span>Configurar Supabase</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
