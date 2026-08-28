create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id text not null check (
    category_id in (
      'general',
      'micro',
      'trauma',
      'gineco-uro',
      'odonto',
      'sets',
      'instrumental',
      'equipamiento',
      'mantencion',
      'insumos',
      'alquiler',
      'habilitacion'
    )
  ),
  filter text not null default '',
  name text not null,
  reference text not null,
  short_description text not null,
  long_description text default '',
  variants text not null default '',
  has_variants boolean not null default false,
  image_url text,
  image_path text,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_reference_key
on public.products (reference);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "Productos visibles para todos" on public.products;
create policy "Productos visibles para todos"
on public.products for select
using (true);

drop policy if exists "Usuarios autenticados pueden crear productos" on public.products;
create policy "Usuarios autenticados pueden crear productos"
on public.products for insert
to authenticated
with check (true);

drop policy if exists "Usuarios autenticados pueden editar productos" on public.products;
create policy "Usuarios autenticados pueden editar productos"
on public.products for update
to authenticated
using (true)
with check (true);

drop policy if exists "Usuarios autenticados pueden borrar productos" on public.products;
create policy "Usuarios autenticados pueden borrar productos"
on public.products for delete
to authenticated
using (true);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null default '',
  institution text not null default '',
  phone text not null default '',
  email text not null,
  product_name text not null default '',
  interest text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'quoting', 'sent', 'won', 'lost', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  internal_notes text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.quote_requests add column if not exists status text not null default 'new';
alter table public.quote_requests add column if not exists priority text not null default 'normal';
alter table public.quote_requests add column if not exists internal_notes text not null default '';
alter table public.quote_requests add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quote_requests_status_check') then
    alter table public.quote_requests add constraint quote_requests_status_check
      check (status in ('new', 'contacted', 'quoting', 'sent', 'won', 'lost', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_requests_priority_check') then
    alter table public.quote_requests add constraint quote_requests_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end $$;

drop trigger if exists quote_requests_set_updated_at on public.quote_requests;
create trigger quote_requests_set_updated_at
before update on public.quote_requests
for each row execute function public.set_updated_at();

create index if not exists quote_requests_created_at_idx
on public.quote_requests (created_at desc);

alter table public.quote_requests enable row level security;

drop policy if exists "Visitantes pueden crear cotizaciones" on public.quote_requests;
create policy "Visitantes pueden crear cotizaciones"
on public.quote_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "Usuarios autenticados pueden ver cotizaciones" on public.quote_requests;
create policy "Usuarios autenticados pueden ver cotizaciones"
on public.quote_requests for select
to authenticated
using (true);

drop policy if exists "Usuarios autenticados pueden actualizar cotizaciones" on public.quote_requests;
create policy "Usuarios autenticados pueden actualizar cotizaciones"
on public.quote_requests for update
to authenticated
using (true)
with check (true);

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Imagenes de productos visibles para todos" on storage.objects;
create policy "Imagenes de productos visibles para todos"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "Usuarios autenticados pueden subir imagenes de productos" on storage.objects;
create policy "Usuarios autenticados pueden subir imagenes de productos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "Usuarios autenticados pueden editar imagenes de productos" on storage.objects;
create policy "Usuarios autenticados pueden editar imagenes de productos"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "Usuarios autenticados pueden borrar imagenes de productos" on storage.objects;
create policy "Usuarios autenticados pueden borrar imagenes de productos"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');

insert into public.products
  (category_id, name, reference, short_description, long_description, featured, sort_order)
values
  ('instrumental', 'Instrumental quirurgico ELCON', 'SUP-IQ-ELCON', 'Linea de instrumental quirurgico para pabellon y procedimientos clinicos.', 'Solucion cotizable segun especialidad, volumen de trabajo, requerimientos tecnicos y disponibilidad.', true, 10),
  ('insumos', 'Accesorios medicos monitorizados', 'SUP-AM-UPN', 'Accesorios y partes asociadas a equipos medicos y monitoreo clinico.', 'Linea orientada a continuidad operativa, reposicion y necesidades de servicios clinicos.', true, 20),
  ('mantencion', 'Mantencion de equipamiento medico', 'SUP-ST-001', 'Servicio preventivo y correctivo para asegurar disponibilidad y funcionamiento.', 'Incluye planificacion de mantenciones, respuesta tecnica y apoyo presencial segun cobertura.', true, 30),
  ('equipamiento', 'Gestion de equipamiento clinico', 'SUP-GE-010', 'Seleccion, adquisicion y gestion tecnica de equipos medicos segun necesidad.', 'Apoyo para elegir equipamiento adecuado, gestionar continuidad y resolver brechas operativas.', false, 40),
  ('habilitacion', 'Habilitacion para autorizacion sanitaria', 'SUP-HS-020', 'Acompanamiento tecnico para recintos de salud y exigencias sanitarias.', 'Asesoria basada en conocimiento de normas sanitarias, constructivas, energeticas y requerimientos del area.', false, 50),
  ('insumos', 'Insumos clinicos y desinfectantes', 'SUP-IC-030', 'Insumos de limpieza clinicos, desinfectantes y productos complementarios.', 'Productos cotizables para continuidad operativa y necesidades de centros de salud.', false, 60),
  ('alquiler', 'Alquiler de equipos de monitoreo', 'RM-MON-040', 'Equipos de baja y media complejidad para monitoreo de signos vitales.', 'Solucion temporal para situaciones transitorias, continuidad de servicio o soporte clinico puntual.', false, 70),
  ('alquiler', 'Alquiler de equipamiento de rehabilitacion', 'RM-REH-050', 'Equipos de rehabilitacion disponibles segun necesidad del usuario o institucion.', 'Servicio respaldado por experiencia SUPMED y planificacion de mantencion para continuidad.', false, 80)
on conflict (reference) do nothing;
