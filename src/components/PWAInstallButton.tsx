import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-white px-2.5 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer font-timer"
        title="Instalar aplicación en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] px-2.5 py-1.5 text-xs font-medium transition cursor-pointer"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC] relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <span className="p-1.5 bg-[#10B981]/20 text-[#34D399] rounded-lg">📲</span>
                Instalar en iPhone / iPad
              </h3>

              <div className="mt-4 space-y-3 text-sm text-[#94A3B8]">
                <div className="flex items-start gap-3 p-2.5 bg-[#1E293B] border border-[#334155] rounded-xl">
                  <span className="font-bold text-[#10B981] text-base font-timer">1.</span>
                  <p className="text-[#F8FAFC]">Toca el botón <strong className="text-white">Compartir</strong> en la barra inferior de Safari.</p>
                </div>
                <div className="flex items-start gap-3 p-2.5 bg-[#1E293B] border border-[#334155] rounded-xl">
                  <span className="font-bold text-[#10B981] text-base font-timer">2.</span>
                  <p className="text-[#F8FAFC]">Desplaza hacia abajo y selecciona <strong className="text-white">"Agregar a Inicio"</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-2.5 bg-[#1E293B] border border-[#334155] rounded-xl">
                  <span className="font-bold text-[#10B981] text-base font-timer">3.</span>
                  <p className="text-[#F8FAFC]">¡Listo! Podrás usarla a pantalla completa incluso sin Internet.</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 py-2.5 text-sm font-semibold text-white transition cursor-pointer font-timer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
