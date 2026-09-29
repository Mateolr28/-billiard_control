import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request: { method: string; headers: { get: (arg0: string) => any; }; json: () => any; }) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sesión requerida.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: 'Sesión inválida.' }, 401);

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (profileError || callerProfile?.role !== 'admin' || !callerProfile.is_active) {
    return json({ error: 'Solo un administrador puede gestionar cuentas.' }, 403);
  }

  const body = await request.json();
  if (body.action === 'set_active') {
    if (body.userId === user.id && body.isActive === false) return json({ error: 'No puedes desactivar tu propia cuenta.' }, 400);
    const { error } = await adminClient.from('profiles').update({ is_active: Boolean(body.isActive), updated_at: new Date().toISOString() }).eq('id', body.userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (!body.email || !body.password || !body.fullName || !['admin', 'operador'].includes(body.role)) {
    return json({ error: 'Datos de cuenta incompletos.' }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: String(body.email).trim().toLowerCase(),
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: String(body.fullName).trim() },
  });
  if (createError || !created.user) return json({ error: createError?.message || 'No fue posible crear el usuario.' }, 400);

  const { error: profileUpdateError } = await adminClient.from('profiles').update({
    full_name: String(body.fullName).trim(),
    role: body.role,
    is_active: true,
    updated_at: new Date().toISOString(),
  }).eq('id', created.user.id);
  if (profileUpdateError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: profileUpdateError.message }, 400);
  }

  return json({ ok: true, userId: created.user.id });
});