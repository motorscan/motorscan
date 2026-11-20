create extension if not exists pgcrypto;

create table if not exists public.eventos_telemetria (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  tipo_evento varchar(100) not null,
  datos jsonb not null default '{}'::jsonb,
  session_id varchar(128) not null
);

create table if not exists public.errores_app (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  mensaje_error text not null,
  contexto jsonb not null default '{}'::jsonb,
  origen varchar(100) not null
);

create table if not exists public.historial_diagnosticos (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  tipo_vehiculo varchar(30) not null,
  sintomas_reportados jsonb not null default '[]'::jsonb,
  falla_resultante jsonb,
  session_id varchar(128) not null
);

create index if not exists idx_historial_session_id
  on public.historial_diagnosticos (session_id);

create index if not exists idx_historial_fecha
  on public.historial_diagnosticos (fecha desc);

alter table public.eventos_telemetria enable row level security;
alter table public.errores_app enable row level security;
alter table public.historial_diagnosticos enable row level security;

-- No se crean políticas públicas. La Service Role Key del backend omite RLS.
