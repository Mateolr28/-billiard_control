import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  UserPlus,
  Search,
  DollarSign,
  Calendar,
  Phone,
  PlusCircle,
  Clock,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { db } from '../db';
import { Customer, Debt, DebtPayment, PaymentMethod } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';

export const FiadosModule: React.FC = () => {
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  const debts = useLiveQuery(() => db.debts.toArray(), []) || [];
  const debtPayments = useLiveQuery(() => db.debt_payments.toArray(), []) || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Abono Form State
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('efectivo');
  const [abonoNote, setAbonoNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter customers
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const totalOutstandingDebt = customers.reduce((acc, c) => acc + (c.current_debt || 0), 0);
  const debtorsCount = customers.filter((c) => (c.current_debt || 0) > 0).length;

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Get combined history for selected customer
  const customerDebts = debts
    .filter((d) => d.customer_id === selectedCustomerId)
    .map((d) => ({
      id: d.id,
      type: 'deuda' as const,
      amount: d.amount,
      date: d.created_at,
      description: `Fiado Mesa ${d.table_number || ''} ${d.items_summary ? `(${d.items_summary})` : ''}`,
      notes: d.notes,
    }));

  const customerPayments = debtPayments
    .filter((p) => p.customer_id === selectedCustomerId)
    .map((p) => ({
      id: p.id,
      type: 'abono' as const,
      amount: p.amount,
      date: p.created_at,
      description: `Abono (${p.payment_method})`,
      notes: p.notes,
    }));

  const combinedHistory = [...customerDebts, ...customerPayments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const customer = await billiardService.createCustomer({
        name: newName,
        phone: newPhone,
        notes: newNotes,
      });

      setNewName('');
      setNewPhone('');
      setNewNotes('');
      setShowNewCustomerModal(false);
      setSelectedCustomerId(customer.id);
    } catch (err: any) {
      alert(err?.message || 'Error al crear cliente');
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setNewName(customer.name);
    setNewPhone(customer.phone || '');
    setNewNotes(customer.notes || '');
    setShowNewCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      if (editingCustomerId) {
        await billiardService.updateCustomer(editingCustomerId, {
          name: newName,
          phone: newPhone,
          notes: newNotes,
        });
      } else {
        await handleCreateCustomer(e);
        return;
      }

      setNewName('');
      setNewPhone('');
      setNewNotes('');
      setEditingCustomerId(null);
      setShowNewCustomerModal(false);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar cliente');
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (
      !window.confirm(
        `¿Eliminar a ${customer.name} de la libreta? Esta acción elimina también su historial de deudas y abonos.`
      )
    ) return;

    try {
      await billiardService.deleteCustomer(customer.id);
      if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
    } catch (err: any) {
      alert(err?.message || 'No se puede eliminar este cliente');
    }
  };

  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const amountNum = parseFloat(abonoAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Ingresa un monto de abono válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await billiardService.registerDebtPayment(selectedCustomerId, amountNum, abonoMethod, abonoNote);
      setAbonoAmount('');
      setAbonoNote('');
      setShowAbonoModal(false);
    } catch (err: any) {
      alert(err?.message || 'Error al registrar abono');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner: Total Fiados */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#273449] border border-[#334155] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">Libreta Digital de Fiados</h2>
            <p className="text-xs text-[#94A3B8]">
              {debtorsCount} clientes con saldo pendiente de cobro
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
          <div className="text-left sm:text-right">
            <span className="text-xs text-[#F59E0B] font-semibold block">Total por Cobrar:</span>
            <span className="text-2xl sm:text-3xl font-black text-[#EF4444] font-timer">
              {formatMoney(totalOutstandingDebt)}
            </span>
          </div>

          <button
            onClick={() => {
              setEditingCustomerId(null);
              setNewName('');
              setNewPhone('');
              setNewNotes('');
              setShowNewCustomerModal(true);
            }}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Customers List, Right Selected Customer Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Search & Customer Cards */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center bg-[#273449] rounded-2xl border border-[#334155] text-xs text-[#94A3B8]">
                No se encontraron clientes.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === selectedCustomerId;
                const hasDebt = (c.current_debt || 0) > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1E293B] border-[#10B981] shadow-md'
                        : 'bg-[#273449] border-[#334155] hover:border-[#94A3B8]/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-[#F8FAFC] flex items-center gap-2">
                        <span>{c.name}</span>
                        {hasDebt && (
                          <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                        )}
                      </div>
                      {c.phone && (
                        <div className="text-xs text-[#94A3B8] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-[#94A3B8]" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[11px] text-[#94A3B8]">Debe:</div>
                        <div
                          className={`text-sm font-black font-timer ${
                            hasDebt ? 'text-[#EF4444]' : 'text-[#94A3B8]'
                          }`}
                        >
                          {formatMoney(c.current_debt || 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Editar cliente"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEditCustomer(c);
                          }}
                          className="p-2 rounded-lg text-[#94A3B8] hover:text-[#10B981] hover:bg-[#1E293B] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Eliminar cliente"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCustomer(c);
                          }}
                          className="p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#1E293B] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer Details & Transaction History */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <div className="p-5 sm:p-6 rounded-2xl bg-[#273449] border border-[#334155] space-y-5 shadow-xl">
              {/* Customer Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#334155]">
                <div>
                  <h3 className="text-xl font-black text-[#F8FAFC]">{selectedCustomer.name}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-[#94A3B8] mt-1">
                    {selectedCustomer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#94A3B8]" /> {selectedCustomer.phone}
                      </span>
                    )}
                    {selectedCustomer.notes && <span>Nota: {selectedCustomer.notes}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] text-right">
                    <span className="text-[11px] text-[#F59E0B] font-bold uppercase block">
                      Saldo Deudor:
                    </span>
                    <span className="text-2xl font-black text-[#EF4444] font-timer">
                      {formatMoney(selectedCustomer.current_debt || 0)}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowAbonoModal(true)}
                    disabled={(selectedCustomer.current_debt || 0) <= 0}
                    className="py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-40 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>REGISTRAR ABONO</span>
                  </button>
                </div>
              </div>

              {/* Transaction History */}
              <div>
                <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-3">
                  Historial de Movimientos ({combinedHistory.length})
                </h4>

                {combinedHistory.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-[#1E293B] border border-[#334155] text-xs text-[#94A3B8]">
                    No hay registros de fiados o abonos para este cliente todavía.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {combinedHistory.map((item) => {
                      const isFiado = item.type === 'deuda';
                      const formattedDate = new Date(item.date).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155]"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-xl ${
                                isFiado
                                  ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                                  : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                              }`}
                            >
                              {isFiado ? (
                                <ArrowUpCircle className="w-4 h-4" />
                              ) : (
                                <ArrowDownCircle className="w-4 h-4" />
                              )}
                            </div>

                            <div>
                              <div className={`text-sm font-bold font-timer ${isFiado ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                                {isFiado ? 'Fiado +' : 'Abono -'} {formatMoney(item.amount)}
                              </div>
                              <div className="text-xs text-[#94A3B8]">
                                {item.description} {item.notes ? `• ${item.notes}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-[#94A3B8] text-right font-timer">
                            {formattedDate}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-[#273449] border border-[#334155] text-[#94A3B8]">
              <BookOpen className="w-12 h-12 text-[#94A3B8]/50 mb-3" />
              <p className="font-bold text-[#F8FAFC]">Selecciona un cliente</p>
              <p className="text-xs text-[#94A3B8] mt-1">
                Toca cualquier cliente de la lista para ver su saldo, historial y registrar abonos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC] relative">
            <button
              onClick={() => setShowNewCustomerModal(false)}
              className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#F8FAFC] mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#10B981]" />
              <span>{editingCustomerId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</span>
            </h3>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Roberto Gómez"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Teléfono (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. 312 345 6789"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Nota (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Amigo de Carlos, juega los viernes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold border border-[#334155] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingCustomerId ? 'Guardar Cambios' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Abono Modal */}
      {showAbonoModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC] relative">
            <button
              onClick={() => setShowAbonoModal(false)}
              className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#F8FAFC] mb-2">Registrar Abono</h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Cliente: <strong className="text-white">{selectedCustomer.name}</strong> • Debe:{' '}
              <strong className="text-[#EF4444] font-timer">{formatMoney(selectedCustomer.current_debt || 0)}</strong>
            </p>

            <form onSubmit={handleRegisterAbono} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[#94A3B8]">Valor del Abono o Pago Total *</label>
                  <button
                    type="button"
                    onClick={() => setAbonoAmount(String(selectedCustomer.current_debt || 0))}
                    className="text-[11px] font-bold text-[#10B981] hover:text-white cursor-pointer"
                  >
                    Pagar todo ({formatMoney(selectedCustomer.current_debt || 0)})
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="100"
                  max={selectedCustomer.current_debt || 0}
                  step="100"
                  placeholder="Ej. 30000"
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-base font-bold text-[#10B981] focus:outline-hidden focus:border-[#10B981] font-timer"
                />
                {abonoAmount && !isNaN(parseFloat(abonoAmount)) && (
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Nuevo saldo restante:{' '}
                    <strong className="text-white font-timer">
                      {formatMoney(
                        Math.max(0, (selectedCustomer.current_debt || 0) - parseFloat(abonoAmount))
                      )}
                    </strong>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAbonoMethod('efectivo')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                      abonoMethod === 'efectivo'
                        ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                        : 'bg-[#1E293B] border-[#334155] text-[#94A3B8]'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Efectivo (Caja)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbonoMethod('transferencia')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                      abonoMethod === 'transferencia'
                        ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6]'
                        : 'bg-[#1E293B] border-[#334155] text-[#94A3B8]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>Transferencia</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Nota (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Pago parcial fin de semana"
                  value={abonoNote}
                  onChange={(e) => setAbonoNote(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAbonoModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold border border-[#334155] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Guardando...' : 'Confirmar Abono'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
