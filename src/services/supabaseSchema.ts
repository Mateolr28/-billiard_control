export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- BILLAR CONTROL - ESQUEMA DE BASE DE DATOS SUPABASE POSTGRESQL CON RLS
-- Generado para operación rápida y sincronización offline-first idempotente
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE ESTABLECIMIENTO
CREATE TABLE IF NOT EXISTS public.establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Billar El Trébol',
    default_hourly_rate NUMERIC NOT NULL DEFAULT 10000,
    allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA DE MESAS
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'libre' CHECK (status IN ('libre', 'jugando', 'pausada', 'prepago', 'pendiente_pago', 'fuera_servicio')),
    hourly_rate NUMERIC NOT NULL DEFAULT 10000,
    current_session_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA DE SESIONES DE JUEGO (CRONÓMETROS)
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'libre' CHECK (mode IN ('libre', 'prepago')),
    prepago_minutes INTEGER,
    started_at TIMESTAMPTZ NOT NULL,
    paused_at TIMESTAMPTZ,
    total_paused_seconds INTEGER NOT NULL DEFAULT 0,
    ended_at TIMESTAMPTZ,
    hourly_rate NUMERIC NOT NULL DEFAULT 10000,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
    customer_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLA DE PRODUCTOS (INVENTARIO SIMPLE)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    category TEXT NOT NULL DEFAULT 'Bebidas',
    icon TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLA DE CONSUMOS EN SESIÓN ACTIVA
CREATE TABLE IF NOT EXISTS public.session_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.table_sessions(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    product_icon TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABLA DE CLIENTES (LIBRETA DE FIADOS)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    current_debt NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLA DE DEUDAS (CUENTAS FIADAS)
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
    table_number INTEGER,
    amount NUMERIC NOT NULL,
    time_amount NUMERIC NOT NULL DEFAULT 0,
    items_amount NUMERIC NOT NULL DEFAULT 0,
    items_summary TEXT,
    played_time_seconds INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    is_settled BOOLEAN NOT NULL DEFAULT false,
    remaining_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLA DE ABONOS A DEUDAS
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'efectivo',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABLA DE VENTAS FINALIZADAS
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
    table_number INTEGER,
    time_amount NUMERIC NOT NULL DEFAULT 0,
    items_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'efectivo',
    time_played_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABLA DE ITEMS DE VENTA
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABLA DE CUENTAS ABIERTAS DE CLIENTES
CREATE TABLE IF NOT EXISTS public.customer_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    phone TEXT,
    location TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'cerrada')),
    total_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    payment_method TEXT
);

-- 13. TABLA DE ITEMS DE CUENTAS ABIERTAS
CREATE TABLE IF NOT EXISTS public.customer_tab_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tab_id UUID NOT NULL REFERENCES public.customer_tabs(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    product_icon TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. TABLA DE MOVIMIENTOS DE CAJA (BOLSILLO)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    amount NUMERIC NOT NULL,
    concept TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. TABLA DE CIERRES DIARIOS
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    cash_sales NUMERIC NOT NULL DEFAULT 0,
    other_sales NUMERIC NOT NULL DEFAULT 0,
    cash_debt_payments NUMERIC NOT NULL DEFAULT 0,
    cash_inflow NUMERIC NOT NULL DEFAULT 0,
    cash_outflow NUMERIC NOT NULL DEFAULT 0,
    expected_cash NUMERIC NOT NULL DEFAULT 0,
    counted_cash NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    total_debts_created NUMERIC NOT NULL DEFAULT 0,
    debts_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_by TEXT
);

-- 16. LOG DE AUDITORÍA Y OPERACIONES DE SINCRONIZACIÓN
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. TABLA DE MAQUINITAS TRAGAMONEDAS
CREATE TABLE IF NOT EXISTS public.slot_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT,
    location TEXT,
    coin_denomination NUMERIC NOT NULL DEFAULT 500,
    initial_balance NUMERIC NOT NULL DEFAULT 0,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    total_in NUMERIC NOT NULL DEFAULT 0,
    total_paid_out NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'mantenimiento', 'inactiva')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. TABLA DE MOVIMIENTOS DE MAQUINITAS (PREMIOS SACADOS, INGRESOS, ARQUEOS)
CREATE TABLE IF NOT EXISTS public.slot_machine_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID REFERENCES public.slot_machines(id) ON DELETE CASCADE,
    machine_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('premio_jugador', 'ingreso_jugadas', 'fondo_inicial', 'recarga_fondo', 'vaciado_ganancia', 'ajuste_arqueo')),
    amount NUMERIC NOT NULL,
    previous_balance NUMERIC NOT NULL,
    new_balance NUMERIC NOT NULL,
    player_name TEXT,
    notes TEXT,
    sent_to_cash BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_machine_movements ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para la operación del local (autenticados y anon con clave de proyecto)
CREATE POLICY "Permitir todo a usuarios autenticados y clave de aplicacion" 
ON public.tables FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en maquinitas" 
ON public.slot_machines FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en movimientos maquinitas" 
ON public.slot_machine_movements FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en sesiones" 
ON public.table_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en consumos" 
ON public.session_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en productos" 
ON public.products FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en clientes" 
ON public.customers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en deudas" 
ON public.debts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en abonos" 
ON public.debt_payments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en ventas" 
ON public.sales FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en items venta" 
ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en cuentas abiertas"
ON public.customer_tabs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en items de cuentas abiertas"
ON public.customer_tab_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en caja" 
ON public.cash_movements FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en cierres" 
ON public.daily_closings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo en auditoria" 
ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ÍNDICES PARA BÚSQUEDA RÁPIDA
CREATE INDEX IF NOT EXISTS idx_tables_status ON public.tables(status);
CREATE INDEX IF NOT EXISTS idx_sessions_table ON public.table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON public.debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_cash_created ON public.cash_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_tabs_status ON public.customer_tabs(status);
CREATE INDEX IF NOT EXISTS idx_customer_tab_items_tab ON public.customer_tab_items(tab_id);
`;

export const SUPABASE_SCHEMA_SQL = SUPABASE_SQL_SCHEMA;
