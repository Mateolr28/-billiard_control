-- BILLAR CONTROL - AUTENTICACION Y ROLES
-- Ejecutar despues de la migracion existente del esquema de Billar Control.
-- No contiene contrasenas. Crea el primer usuario desde Supabase Dashboard > Authentication > Users.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'operador' check (role in ('admin', 'operador')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Cada registro operativo pertenece a una sola cuenta. Los datos antiguos sin
-- propietario quedan ocultos hasta que se asignen explícitamente a una cuenta.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'establishments', 'tables', 'table_sessions', 'session_items', 'products',
    'customers', 'debts', 'debt_payments', 'sales', 'sale_items',
    'customer_tabs', 'customer_tab_items', 'cash_movements', 'daily_closings',
    'audit_logs', 'slot_machines', 'slot_machine_movements'
  ]
  loop
    execute format('alter table public.%I add column if not exists owner_id uuid references auth.users(id)', table_name);
  end loop;
end;
$$;

-- Conserva los datos existentes en la cuenta administradora inicial.
do $$
declare
  table_name text;
  first_admin uuid;
begin
  select id into first_admin
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;

  if first_admin is not null then
    foreach table_name in array array[
      'establishments', 'tables', 'table_sessions', 'session_items', 'products',
      'customers', 'debts', 'debt_payments', 'sales', 'sale_items',
      'customer_tabs', 'customer_tab_items', 'cash_movements', 'daily_closings',
      'audit_logs', 'slot_machines', 'slot_machine_movements'
    ]
    loop
      execute format('update public.%I set owner_id = $1 where owner_id is null', table_name)
      using first_admin;
    end loop;
  end if;
end;
$$;

-- The old schema used USING (true). Remove those policies before enabling the protected ones.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'establishments', 'tables', 'table_sessions', 'session_items', 'products',
        'customers', 'debts', 'debt_payments', 'sales', 'sale_items',
        'customer_tabs', 'customer_tab_items', 'cash_movements', 'daily_closings',
        'audit_logs', 'slot_machines', 'slot_machine_movements'
      )
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'establishments', 'tables', 'table_sessions', 'session_items', 'products',
    'customers', 'debts', 'debt_payments', 'sales', 'sale_items',
    'customer_tabs', 'customer_tab_items', 'cash_movements', 'daily_closings',
    'audit_logs', 'slot_machines', 'slot_machine_movements'
  ]
  loop
    execute format(
      'create policy authenticated_access on public.%I for all to authenticated using (public.is_active_user() and owner_id = auth.uid()) with check (public.is_active_user() and owner_id = auth.uid())',
      table_name
    );
  end loop;
end;
$$;

-- Create this user manually in Dashboard, then promote it as the first administrator:
-- update public.profiles set role = 'admin' where email = 'admin@tu-billar.com';