import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Power, UserPlus, Users } from 'lucide-react';
import { AppRole, UserProfile, authService } from '../services/authService';

export const AdminUsersModule: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('operador');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      setError('');
      setUsers(await authService.listUsers());
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar las cuentas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await authService.createUser({ email: email.trim(), password, fullName: fullName.trim(), role });
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('operador');
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'No fue posible crear la cuenta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (user: UserProfile) => {
    try {
      setError('');
      await authService.setUserActive(user.id, !user.is_active);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'No fue posible actualizar la cuenta.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#34D399]">Administración</p>
        <h2 className="mt-1 text-2xl font-black text-[#F8FAFC]">Cuentas del equipo</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">Crea y desactiva accesos. El registro público permanece cerrado.</p>
      </div>

      {error && <p className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 text-xs text-[#FCA5A5]">{error}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-[#334155] bg-[#1E293B] p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#F8FAFC]"><UserPlus className="w-4 h-4 text-[#34D399]" />Nueva cuenta</div>
          <label className="block text-xs font-semibold text-[#CBD5E1]">Nombre completo<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#475569] bg-[#0F172A] px-3 py-2.5 text-sm outline-none focus:border-[#10B981]" /></label>
          <label className="block text-xs font-semibold text-[#CBD5E1]">Correo electrónico<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#475569] bg-[#0F172A] px-3 py-2.5 text-sm outline-none focus:border-[#10B981]" /></label>
          <label className="block text-xs font-semibold text-[#CBD5E1]">Contraseña temporal<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#475569] bg-[#0F172A] px-3 py-2.5 text-sm outline-none focus:border-[#10B981]" /></label>
          <label className="block text-xs font-semibold text-[#CBD5E1]">Rol<select value={role} onChange={(event) => setRole(event.target.value as AppRole)} className="mt-1.5 w-full rounded-xl border border-[#475569] bg-[#0F172A] px-3 py-2.5 text-sm outline-none focus:border-[#10B981]"><option value="operador">Operador</option><option value="admin">Administrador</option></select></label>
          <button disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-black text-white hover:bg-[#059669] disabled:opacity-50"><KeyRound className="w-4 h-4" />{isSaving ? 'Creando...' : 'Crear cuenta'}</button>
        </form>

        <section className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#F8FAFC]"><Users className="w-4 h-4 text-[#60A5FA]" />Cuentas existentes</div>
          {isLoading ? <p className="text-sm text-[#94A3B8]">Cargando cuentas...</p> : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#334155] bg-[#273449] p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-[#F8FAFC]">{user.full_name}</p><p className="truncate text-xs text-[#94A3B8]">{user.email} · {user.role === 'admin' ? 'Administrador' : 'Operador'}</p></div>
                  <button onClick={() => handleToggle(user)} title={user.is_active ? 'Desactivar cuenta' : 'Activar cuenta'} className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-bold ${user.is_active ? 'border-[#10B981]/40 text-[#34D399]' : 'border-[#64748B] text-[#94A3B8]'}`}>
                    {user.is_active ? <><Check className="w-3.5 h-3.5" /> Activa</> : <><Power className="w-3.5 h-3.5" /> Inactiva</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};