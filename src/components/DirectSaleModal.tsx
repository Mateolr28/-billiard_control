import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  BookOpen,
  UserPlus,
  ShoppingBag,
  AlertTriangle,
  CreditCard,
  Banknote,
  Send,
} from 'lucide-react';
import { db } from '../db';
import { Product, PaymentMethod, Customer } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney, generateUUID } from '../utils/billing';
import { soundService } from '../utils/sound';

interface DirectSaleModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const DirectSaleModal: React.FC<DirectSaleModalProps> = ({ onClose, onSuccess }) => {
  const products =
    useLiveQuery(
      () => db.products.toArray().then((arr) => arr.filter((p) => Boolean(p.is_active))),
      []
    ) || [];

  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // Checkout states: 'cart' | 'pay' | 'fiado'
  const [viewState, setViewState] = useState<'cart' | 'pay' | 'fiado'>('cart');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Fiado customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract categories
  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.category || 'Otros')))];

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    soundService.playCashPing();
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const numReceived = parseFloat(cashReceived) || 0;
  const changeAmount = Math.max(0, numReceived - totalAmount);

  // Direct checkout
  const handleCheckoutPaid = async () => {
    if (cart.length === 0) return;
    setError(null);
    setLoading(true);

    try {
      const itemsPayload = cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
        unitPrice: c.product.price,
        name: c.product.name,
        icon: c.product.icon,
      }));

      await billiardService.directSale(itemsPayload, paymentMethod, 'Cliente Mostrador / Barra');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar venta');
      setLoading(false);
    }
  };

  // Direct fiado
  const handleCheckoutFiado = async () => {
    if (cart.length === 0) return;
    setError(null);
    setLoading(true);

    try {
      let targetCustomerId = selectedCustomerId;

      if (isCreatingCustomer || !targetCustomerId) {
        if (!newCustomerName.trim()) {
          throw new Error('Ingresa el nombre del cliente para registrar el fiado');
        }
        const now = new Date().toISOString();
        const newCust: Customer = {
          id: generateUUID(),
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          current_debt: 0,
          created_at: now,
          updated_at: now,
        };
        await db.customers.add(newCust);
        targetCustomerId = newCust.id;
      }

      const itemsPayload = cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
        unitPrice: c.product.price,
        name: c.product.name,
        icon: c.product.icon,
      }));

      await billiardService.directSaleToDebt(targetCustomerId, itemsPayload, 'Fiado barra / sin mesa');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar fiado');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-[#273449] border border-[#334155] p-4 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pb-3 border-b border-[#334155] pr-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍹</span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC] leading-tight">
                Venta en Barra / Cliente sin Mesa
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Registra consumos para clientes que no están jugando en mesa
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold">
            {error}
          </div>
        )}

        {/* View States: Catalog & Cart */}
        {viewState === 'cart' && (
          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {/* Search and Category Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Buscar producto (cerveza, agua, papas...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-10 pr-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#10B981] text-white shadow-xs'
                        : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155] border border-[#334155]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div>
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block mb-2">
                Catálogo de Productos ({filteredProducts.length})
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredProducts.map((prod) => {
                  const cartItem = cart.find((c) => c.product.id === prod.id);
                  const isOutOfStock = prod.stock <= 0;

                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => !isOutOfStock && addToCart(prod)}
                      disabled={isOutOfStock}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between min-h-[88px] transition active:scale-95 cursor-pointer relative ${
                        isOutOfStock
                          ? 'bg-[#1E293B]/40 border-[#EF4444]/30 opacity-50 cursor-not-allowed'
                          : cartItem
                          ? 'bg-[#1E293B] border-[#10B981] ring-1 ring-[#10B981]/50 shadow-md'
                          : 'bg-[#1E293B] hover:bg-[#1E293B]/80 border-[#334155] hover:border-[#10B981]/50 shadow-xs'
                      }`}
                    >
                      {cartItem && (
                        <span className="absolute -top-1.5 -right-1.5 bg-[#10B981] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md font-timer">
                          x{cartItem.quantity}
                        </span>
                      )}

                      <div className="flex items-start justify-between">
                        <span className="text-2xl">{prod.icon || '📦'}</span>
                        <span className="text-xs font-black text-[#10B981] bg-[#273449] px-1.5 py-0.5 rounded border border-[#334155] font-timer">
                          {formatMoney(prod.price)}
                        </span>
                      </div>

                      <div className="mt-1">
                        <div className="font-bold text-xs text-[#F8FAFC] line-clamp-1">
                          {prod.name}
                        </div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {isOutOfStock ? (
                            <span className="text-[#EF4444] font-bold">Agotado</span>
                          ) : (
                            <span className="font-timer">Stock: {prod.stock}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Basket / Cart */}
            <div className="pt-3 border-t border-[#334155]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#10B981]" />
                  Canasta de Consumo ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                </span>
                <span className="text-sm font-black text-[#10B981] font-timer">
                  Total: {formatMoney(totalAmount)}
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155] text-center text-xs text-[#94A3B8]">
                  Toca cualquier producto arriba para agregarlo a la cuenta de barra.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#1E293B] border border-[#334155] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span>{item.product.icon || '📦'}</span>
                        <span className="font-bold text-[#F8FAFC]">{item.product.name}</span>
                        <span className="text-[#94A3B8] font-timer">
                          ({formatMoney(item.product.price)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-[#273449] border border-[#334155] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 rounded text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] cursor-pointer"
                          >
                            {item.quantity === 1 ? (
                              <Trash2 className="w-3 h-3 text-[#EF4444]" />
                            ) : (
                              <Minus className="w-3 h-3" />
                            )}
                          </button>
                          <span className="w-6 text-center font-bold text-[#F8FAFC] font-timer">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 rounded text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-black text-[#10B981] w-16 text-right font-timer">
                          {formatMoney(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-[#334155] grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setViewState('fiado')}
                className="py-3 px-3 rounded-xl bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 border border-[#F59E0B]/40 text-[#F59E0B] font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>PASAR A FIADO</span>
              </button>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  setCashReceived(totalAmount.toString());
                  setViewState('pay');
                }}
                className="py-3 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer font-timer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>COBRAR ({formatMoney(totalAmount)})</span>
              </button>
            </div>
          </div>
        )}

        {/* View State: Pay Immediately */}
        {viewState === 'pay' && (
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-between">
              <span className="text-sm font-bold text-[#94A3B8]">Total a Cobrar:</span>
              <span className="text-2xl font-black text-[#10B981] font-timer">{formatMoney(totalAmount)}</span>
            </div>

            {/* Payment method selector */}
            <div>
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block mb-2">
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                  { id: 'transferencia', label: 'Nequi / Transf.', icon: Send },
                  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                ].map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-[#10B981] text-white border-[#10B981] shadow-md'
                          : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] border-[#334155] hover:bg-[#334155]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Calculator if Efectivo */}
            {paymentMethod === 'efectivo' && (
              <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#94A3B8]">Efectivo Recibido</label>
                  <div className="flex gap-1.5">
                    {[10000, 20000, 50000, 100000].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setCashReceived(b.toString())}
                        className="px-2 py-0.5 rounded bg-[#273449] hover:bg-[#334155] text-[#F8FAFC] text-[10px] font-bold border border-[#334155] cursor-pointer font-timer"
                      >
                        ${(b / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-[#94A3B8] font-bold">$</span>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full bg-[#273449] border border-[#334155] rounded-xl pl-8 pr-3.5 py-2 text-lg font-black text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
                  />
                </div>

                {numReceived >= totalAmount && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#273449] border border-[#10B981]/40 text-xs">
                    <span className="font-bold text-[#10B981]">Cambio / Vuelto:</span>
                    <span className="font-black text-base text-[#34D399] font-timer">
                      {formatMoney(changeAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setViewState('cart')}
                className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] font-bold text-xs text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer transition"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckoutPaid}
                className="flex-2 py-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 font-black text-xs text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition font-timer"
              >
                {loading ? 'Procesando...' : `CONFIRMAR PAGO (${formatMoney(totalAmount)})`}
              </button>
            </div>
          </div>
        )}

        {/* View State: Fiado to Customer */}
        {viewState === 'fiado' && (
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#1E293B] border border-[#F59E0B]/40 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#F59E0B] block font-semibold">
                  Monto a agregar a la Libreta de Fiados
                </span>
                <span className="text-xl font-black text-[#F59E0B] font-timer">{formatMoney(totalAmount)}</span>
              </div>
              <BookOpen className="w-8 h-8 text-[#F59E0B]/50" />
            </div>

            {/* Customer select or create */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                  Cliente Deudor
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingCustomer(!isCreatingCustomer)}
                  className="text-xs text-[#10B981] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isCreatingCustomer ? 'Elegir existente' : '+ Nuevo cliente'}</span>
                </button>
              </div>

              {!isCreatingCustomer ? (
                <div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#F8FAFC] focus:outline-hidden focus:border-[#F59E0B]"
                  >
                    <option value="">-- Selecciona un cliente --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.current_debt > 0 ? `(Debe: ${formatMoney(c.current_debt)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#334155] space-y-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-[#94A3B8] block mb-1">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Don Carlos, Juan Mecánico"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full bg-[#273449] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#F59E0B]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#94A3B8] block mb-1">
                      Teléfono / WhatsApp (Opcional)
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej: 300 123 4567"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full bg-[#273449] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#F59E0B]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setViewState('cart')}
                className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] font-bold text-xs text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer transition"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={loading || (!selectedCustomerId && !newCustomerName.trim())}
                onClick={handleCheckoutFiado}
                className="flex-2 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 font-black text-xs text-[#0F172A] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition font-timer"
              >
                {loading ? 'Guardando...' : `CONFIRMAR FIADO (${formatMoney(totalAmount)})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
