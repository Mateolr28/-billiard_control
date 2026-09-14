import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Cloud,
  Database,
  RefreshCw,
  Copy,
  Check,
  Package,
  Layers,
  Save,
  AlertCircle,
} from 'lucide-react';
import { db } from '../db';
import { BilliardTable, Product } from '../types';
import { syncService } from '../services/syncService';
import { SUPABASE_SCHEMA_SQL } from '../services/supabaseSchema';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';

export const SettingsModule: React.FC = () => {
  const activeTabDefault: 'tables' | 'products' | 'supabase' = 'tables';
  const [activeTab, setActiveTab] = useState<'tables' | 'products' | 'supabase'>(activeTabDefault);

  const tables = useLiveQuery(() => db.billiard_tables.toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  // Supabase connection state
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem('SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    localStorage.getItem('SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Table edit modal / form
  const [editingTable, setEditingTable] = useState<BilliardTable | null>(null);
  const [newTableNumber, setNewTableNumber] = useState<number>(tables.length + 1);
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableRate, setNewTableRate] = useState<number>(10000);

  // Product edit modal / form
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdIcon, setNewProdIcon] = useState('🍺');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('24');
  const [newProdMinStock, setNewProdMinStock] = useState('5');
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const emojiList = ['🍺', '🥤', '💧', '🍟', '🍬', '🚬', '🍫', '🥪', '☕', '⚡', '🍸', '🎱'];

  // Save Supabase credentials
  const handleSaveSupabase = async () => {
    setTestResult(null);
    try {
      syncService.updateCredentials(supabaseUrl.trim(), supabaseAnonKey.trim());
      const test = await syncService.testSupabaseConnection();
      if (test.ok) {
        setTestResult('🟢 ¡Conexión con Supabase verificada exitosamente!');
      } else {
        setTestResult(`🟡 Credenciales guardadas, pero la prueba devolvió: ${test.message}`);
      }
    } catch (err: any) {
      setTestResult(`🔴 Error: ${err?.message || 'Fallo de conexión'}`);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Add / Edit Table
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      if (editingTable) {
        await db.billiard_tables.update(editingTable.id, {
          name: newTableName,
          hourly_rate: Number(newTableRate),
          updated_at: now,
        });
        setEditingTable(null);
      } else {
        const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        await db.billiard_tables.add({
          id,
          number: Number(newTableNumber),
          name: newTableName || `Mesa ${newTableNumber}`,
          status: 'libre',
          hourly_rate: Number(newTableRate),
          current_session_id: null,
          is_active: true,
          updated_at: now,
        });
      }
      setNewTableName('');
    } catch (err: any) {
      alert(err?.message || 'Error al guardar mesa');
    }
  };

  // Add / Edit Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceNum = parseFloat(newProdPrice);
      const stockNum = parseInt(newProdStock, 10);
      const minStockNum = parseInt(newProdMinStock, 10);

      if (editingProduct) {
        await billiardService.updateProduct(editingProduct.id, {
          name: newProdName.trim(),
          icon: newProdIcon,
          price: priceNum,
          stock: stockNum,
          min_stock: minStockNum,
        });
        setEditingProduct(null);
      } else {
        await billiardService.createProduct({
          name: newProdName.trim(),
          category: 'Bebidas',
          icon: newProdIcon,
          price: priceNum,
          stock: stockNum,
          min_stock: minStockNum,
        });
        setShowAddProductModal(false);
      }

      setNewProdName('');
      setNewProdPrice('');
      setNewProdStock('24');
    } catch (err: any) {
      alert(err?.message || 'Error al guardar producto');
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar permanentemente el producto "${productName}"?`)) {
      try {
        await billiardService.deleteProduct(productId, false);
      } catch (err: any) {
        alert(err?.message || 'Error al eliminar producto');
      }
    }
  };

  const handleReloadDemo = async () => {
    if (
      window.confirm(
        '¿Deseas restaurar las 6 mesas, productos y clientes iniciales de prueba? (Se reseteará la base de datos local)'
      )
    ) {
      await billiardService.reloadDemoData();
      alert('Datos de prueba recargados correctamente.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-[#1E293B] rounded-2xl border border-[#334155] w-fit">
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'tables'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Mesas y Tarifas ({tables.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'products'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Productos y Precios ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'supabase'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Sincronización Supabase</span>
        </button>
      </div>

      {/* 1. MESAS Y TARIFAS */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Configuración de Mesas</h3>
              <p className="text-xs text-[#94A3B8]">
                Ajusta las tarifas por hora y administra las mesas del establecimiento
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTable(null);
                setNewTableNumber(tables.length + 1);
                setNewTableName(`Mesa ${tables.length + 1}`);
                setNewTableRate(10000);
              }}
              className="py-2 px-3.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Mesa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tables.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-[#273449] border border-[#334155] flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E293B] border border-[#334155] text-[#F8FAFC] flex items-center justify-center font-black font-timer">
                    {t.number}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#F8FAFC]">{t.name}</h4>
                    <p className="text-xs text-[#10B981] font-semibold font-timer">
                      {formatMoney(t.hourly_rate)} / hora
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingTable(t);
                    setNewTableName(t.name);
                    setNewTableRate(t.hourly_rate);
                  }}
                  className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] transition cursor-pointer"
                  title="Editar Tarifa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Edit Table Modal */}
          {editingTable && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
              <div className="w-full max-w-sm rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC]">
                <h3 className="text-base font-bold text-[#F8FAFC] mb-4">
                  Editar {editingTable.name}
                </h3>
                <form onSubmit={handleSaveTable} className="space-y-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-1">Nombre</label>
                    <input
                      type="text"
                      required
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-1">Tarifa por Hora ($)</label>
                    <input
                      type="number"
                      required
                      step="500"
                      min="1000"
                      value={newTableRate}
                      onChange={(e) => setNewTableRate(Number(e.target.value))}
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-[#10B981] font-timer focus:outline-hidden focus:border-[#10B981]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingTable(null)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold border border-[#334155] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PRODUCTOS Y PRECIOS */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Inventario y Precios de Consumos</h3>
              <p className="text-xs text-[#94A3B8]">
                Controla los productos que se agregan a las mesas con un solo toque
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProduct(null);
                setNewProdName('');
                setNewProdPrice('');
                setNewProdStock('24');
                setNewProdMinStock('5');
                setShowAddProductModal(true);
              }}
              className="py-2 px-3.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-[#273449] border border-[#334155] flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-[#1E293B] border border-[#334155]">{p.icon || '📦'}</span>
                  <div>
                    <h4 className="font-bold text-sm text-[#F8FAFC]">{p.name}</h4>
                    <p className="text-xs font-bold text-[#10B981] font-timer">{formatMoney(p.price)}</p>
                    <p className="text-[11px] text-[#94A3B8] font-timer">Stock actual: {p.stock} unid.</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingProduct(p);
                      setNewProdName(p.name);
                      setNewProdIcon(p.icon || '🍺');
                      setNewProdPrice(p.price.toString());
                      setNewProdStock(p.stock.toString());
                      setNewProdMinStock((p.min_stock || 5).toString());
                      setShowAddProductModal(true);
                    }}
                    className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] transition cursor-pointer"
                    title="Editar Producto"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id, p.name)}
                    className="p-2 rounded-xl text-[#EF4444] hover:bg-[#EF4444]/10 transition cursor-pointer"
                    title="Quitar / Eliminar Producto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add/Edit Product Modal */}
          {showAddProductModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
              <div className="w-full max-w-sm rounded-2xl bg-[#273449] border border-[#334155] p-6 shadow-2xl text-[#F8FAFC]">
                <h3 className="text-base font-bold text-[#F8FAFC] mb-4">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <form onSubmit={handleSaveProduct} className="space-y-3">
                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-1">Icono / Emoji</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {emojiList.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setNewProdIcon(e)}
                          className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center border transition cursor-pointer ${
                            newProdIcon === e
                              ? 'bg-[#10B981]/20 border-[#10B981] scale-110'
                              : 'bg-[#1E293B] border-[#334155]'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Cerveza Corona"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[#94A3B8] block mb-1">Precio ($) *</label>
                      <input
                        type="number"
                        required
                        min="100"
                        step="100"
                        placeholder="4500"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value)}
                        className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-[#10B981] font-timer focus:outline-hidden focus:border-[#10B981]"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-[#94A3B8] block mb-1">Stock Inicial *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="24"
                        value={newProdStock}
                        onChange={(e) => setNewProdStock(e.target.value)}
                        className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] font-timer focus:outline-hidden focus:border-[#10B981]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddProductModal(false)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold border border-[#334155] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SUPABASE SYNC */}
      {activeTab === 'supabase' && (
        <div className="space-y-5">
          <div className="p-5 rounded-3xl bg-[#273449] border border-[#334155] shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#334155]">
              <div className="p-2.5 rounded-xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#F8FAFC]">Conexión a Supabase (PostgreSQL)</h3>
                <p className="text-xs text-[#94A3B8]">
                  Sincronización en la nube con arquitectura Offline-First
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#94A3B8]">
              <p>
                La aplicación funciona de forma instantánea 100% offline mediante IndexedDB. Para sincronizar
                con tu proyecto de Supabase en tiempo real o en la nube, ingresa tus credenciales:
              </p>

              <div>
                <label className="text-[#94A3B8] block mb-1 font-semibold">SUPABASE_URL</label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] font-mono focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="text-[#94A3B8] block mb-1 font-semibold">SUPABASE_ANON_KEY</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] font-mono focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              {testResult && (
                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] text-xs font-semibold text-[#F8FAFC]">
                  {testResult}
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveSupabase}
                className="py-2.5 px-5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Probar Conexión</span>
              </button>
            </div>
          </div>

          {/* Supabase Schema Helper */}
          <div className="p-5 rounded-3xl bg-[#273449] border border-[#334155] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#F8FAFC] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#10B981]" />
                  <span>Script SQL para Supabase (DDL & RLS)</span>
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  Copia y pega este script en el SQL Editor de tu consola de Supabase
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] text-xs font-semibold border border-[#334155] transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] text-[11px] text-[#94A3B8] overflow-x-auto max-h-44 font-mono">
              {SUPABASE_SCHEMA_SQL}
            </pre>
          </div>

          {/* Reset Demo Data */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleReloadDemo}
              className="py-2 px-3 rounded-xl text-xs text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#EF4444]/30 transition cursor-pointer"
            >
              Restablecer Datos de Demostración Iniciales
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
