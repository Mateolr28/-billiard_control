import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Minus,
  Trash2,
  X,
  ShoppingBag,
  AlertTriangle,
  Search,
  MapPin,
} from 'lucide-react';
import { db } from '../db';
import { CustomerTab, Product } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney, generateUUID } from '../utils/billing';
import { soundService } from '../utils/sound';

interface CustomerTabConsumptionModalProps {
  tab: CustomerTab;
  onClose: () => void;
  onOpenCheckout?: () => void;
}

export const CustomerTabConsumptionModal: React.FC<CustomerTabConsumptionModalProps> = ({
  tab,
  onClose,
  onOpenCheckout,
}) => {
  // Query all active products
  const products =
    useLiveQuery(
      () => db.products.toArray().then((arr) => arr.filter((p) => Boolean(p.is_active))),
      []
    ) || [];

  // Query items for this customer tab
  const tabItems =
    useLiveQuery(
      () => db.customer_tab_items.where('tab_id').equals(tab.id).toArray(),
      [tab.id]
    ) || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [notification, setNotification] = useState<string | null>(null);

  // Custom quick product modal/form toggle
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Extract categories
  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.category || 'Otros')))];

  // Filter products by category and search
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = async (productId: string, productName: string) => {
    try {
      await billiardService.addProductToCustomerTab(tab.id, productId, 1);
      soundService.playCashPing();
      setNotification(`+1 ${productName}`);
      setTimeout(() => setNotification(null), 1200);
    } catch (err: any) {
      alert(err?.message || 'Error al agregar producto');
    }
  };

  const handleAdjustQuantity = async (itemId: string, currentQty: number, delta: number) => {
    try {
      await billiardService.updateCustomerTabItemQuantity(itemId, currentQty + delta);
    } catch (err: any) {
      alert(err?.message || 'Error al modificar cantidad');
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(customPrice);
    if (!customName.trim() || isNaN(priceNum) || priceNum <= 0) {
      alert('Ingresa un nombre y precio válido para el producto');
      return;
    }

    try {
      const now = new Date().toISOString();
      const customProdId = generateUUID();

      // Create quick product in catalog
      const newProd: Product = {
        id: customProdId,
        name: customName.trim(),
        price: priceNum,
        stock: 999,
        min_stock: 5,
        category: 'Varios',
        icon: '🏷️',
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await db.products.add(newProd);

      // Add to customer tab
      await billiardService.addProductToCustomerTab(tab.id, customProdId, 1);
      soundService.playCashPing();
      setCustomName('');
      setCustomPrice('');
      setShowCustomItemForm(false);
      setNotification(`+1 ${newProd.name}`);
      setTimeout(() => setNotification(null), 1200);
    } catch (err: any) {
      alert(err?.message || 'Error al crear producto');
    }
  };

  const totalItemsAmount = tabItems.reduce((acc, curr) => acc + curr.total_price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-[#273449] border border-[#334155] p-4 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto max-h-[94vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#334155] pr-10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" /> Cuenta de Cliente (Paga al final)
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#F8FAFC]">{tab.customer_name}</h2>
              {tab.location && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#1E293B] text-[#3B82F6] border border-[#334155] font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {tab.location}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-[#94A3B8]">Total Acumulado</span>
            <div className="text-lg sm:text-xl font-black text-[#10B981] font-timer">
              {formatMoney(totalItemsAmount)}
            </div>
          </div>
        </div>

        {notification && (
          <div className="mt-2 py-1 px-3 rounded-lg bg-[#10B981]/20 text-[#34D399] text-xs font-bold text-center animate-fade-in border border-[#10B981]/30">
            {notification}
          </div>
        )}

        {/* Search & Category Filter */}
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Buscar cervezas, bebidas, pasabocas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-10 pr-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
            />
          </div>

          {/* Category Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] hover:bg-[#334155]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide">
              Catálogo de Productos ({filteredProducts.length})
            </label>
            <button
              type="button"
              onClick={() => setShowCustomItemForm(!showCustomItemForm)}
              className="text-xs text-[#10B981] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{showCustomItemForm ? 'Ocultar' : '+ Otro producto'}</span>
            </button>
          </div>

          {/* Quick Custom Item Form */}
          {showCustomItemForm && (
            <form
              onSubmit={handleAddCustomItem}
              className="mb-3 p-3 rounded-xl bg-[#1E293B] border border-[#334155] space-y-2"
            >
              <div className="text-xs font-bold text-[#F8FAFC]">
                Agregar producto no registrado en el menú:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nombre (ej: Cigarrillos)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-[#273449] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8]"
                  required
                />
                <input
                  type="number"
                  placeholder="Precio ($)"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="bg-[#273449] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8] font-timer"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomItemForm(false)}
                  className="px-2.5 py-1 rounded bg-[#273449] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334155] text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold cursor-pointer font-timer"
                >
                  Agregar a Cuenta
                </button>
              </div>
            </form>
          )}

          {filteredProducts.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#94A3B8] border border-dashed border-[#334155] rounded-xl">
              No se encontraron productos con ese filtro.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredProducts.map((prod) => {
                const itemInTab = tabItems.find((it) => it.product_id === prod.id);
                const isOutOfStock = prod.stock <= 0;
                const isLowStock = prod.stock > 0 && prod.stock <= prod.min_stock;

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => !isOutOfStock && handleAddProduct(prod.id, prod.name)}
                    disabled={isOutOfStock}
                    className={`group relative p-2.5 rounded-xl border text-left flex flex-col justify-between min-h-[92px] transition active:scale-95 cursor-pointer ${
                      isOutOfStock
                        ? 'bg-[#1E293B]/40 border-[#EF4444]/30 opacity-50 cursor-not-allowed'
                        : itemInTab
                        ? 'bg-[#1E293B] border-[#10B981] ring-1 ring-[#10B981]/50 shadow-md'
                        : 'bg-[#1E293B] hover:bg-[#1E293B]/80 border-[#334155] hover:border-[#10B981]/50 shadow-xs'
                    }`}
                  >
                    {itemInTab && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#10B981] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md font-timer">
                        x{itemInTab.quantity}
                      </span>
                    )}

                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{prod.icon || '📦'}</span>
                      <span className="text-xs font-black text-[#10B981] bg-[#273449] px-1.5 py-0.5 rounded border border-[#334155] font-timer">
                        {formatMoney(prod.price)}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-xs text-[#F8FAFC] group-hover:text-[#34D399] transition line-clamp-1">
                        {prod.name}
                      </div>

                      <div className="flex items-center gap-1 mt-0.5">
                        {isOutOfStock ? (
                          <span className="text-[10px] font-bold text-[#EF4444]">Agotado</span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-bold text-[#F59E0B] flex items-center gap-0.5 font-timer">
                            <AlertTriangle className="w-2.5 h-2.5" /> Stock: {prod.stock}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] font-timer">Stock: {prod.stock}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Items in Customer Tab */}
        <div className="mt-3 pt-3 border-t border-[#334155]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wide flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#10B981]" /> Lo que lleva consumido ({tabItems.length})
            </span>
          </div>

          {tabItems.length === 0 ? (
            <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] text-center text-xs text-[#94A3B8]">
              No hay consumos agregados aún. Toca los productos arriba para sumarlos a su cuenta.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {tabItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-[#1E293B] border border-[#334155] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.product_icon || '📦'}</span>
                    <div>
                      <div className="font-bold text-[#F8FAFC]">{item.product_name}</div>
                      <div className="text-[11px] text-[#94A3B8] font-timer">
                        {formatMoney(item.unit_price)} c/u
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center bg-[#273449] border border-[#334155] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => handleAdjustQuantity(item.id, item.quantity, -1)}
                        className="p-1 rounded text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] cursor-pointer"
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <span className="w-6 text-center font-bold text-sm text-[#F8FAFC] font-timer">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleAdjustQuantity(item.id, item.quantity, 1)}
                        className="p-1 rounded text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-16 text-right font-black text-[#10B981] font-timer">
                      {formatMoney(item.total_price)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions: Guardar y Cerrar / Cobrar Ahora */}
        <div className="mt-3 pt-2 border-t border-[#334155] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] font-bold text-xs sm:text-sm text-[#94A3B8] hover:text-[#F8FAFC] transition cursor-pointer text-center"
          >
            GUARDAR Y SEGUIR
          </button>

          {onOpenCheckout && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCheckout();
              }}
              disabled={tabItems.length === 0}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-50 font-black text-xs sm:text-sm text-white shadow-lg transition active:scale-98 cursor-pointer text-center font-timer"
            >
              COBRAR CUENTA ({formatMoney(totalItemsAmount)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
