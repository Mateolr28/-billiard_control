import React, { useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onAuthenticated: () => void;
  configured: boolean;
  errorMessage?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated, configured, errorMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authService.signIn(email.trim(), password);
      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || 'No fue posible iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-[#1E293B] border border-[#334155] rounded-3xl p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#10B981] text-white flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">BILLAR & CLUB</h1>
            <p className="text-xs text-[#94A3B8]">Acceso privado al sistema</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-bold mb-5">
          <LockKeyhole className="w-4 h-4 text-[#34D399]" />
          Iniciar sesión
        </div>

        {!configured && (
          <p className="mb-4 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-[#FCD34D]">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para activar el acceso.
          </p>
        )}

        {(error || errorMessage) && (
          <p className="mb-4 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 text-xs text-[#FCA5A5]">
            {error || errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-semibold text-[#CBD5E1]">
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#475569] bg-[#0F172A] px-3 py-3 text-sm text-[#F8FAFC] outline-none focus:border-[#10B981]"
            />
          </label>
          <label className="block text-xs font-semibold text-[#CBD5E1]">
            Contraseña
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#475569] bg-[#0F172A] px-3 py-3 text-sm text-[#F8FAFC] outline-none focus:border-[#10B981]"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || !configured}
            className="w-full rounded-xl bg-[#10B981] px-4 py-3 text-sm font-black text-white transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Validando...' : 'Entrar'}
            </span>
          </button>
        </form>
        <p className="mt-5 text-center text-[11px] text-[#64748B]">Las cuentas solo las crea un administrador.</p>
      </section>
    </main>
  );
};