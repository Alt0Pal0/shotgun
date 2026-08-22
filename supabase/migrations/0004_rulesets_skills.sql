-- 0004 Versioned jurisdiction rule sets and skill catalog
create table public.jurisdiction_rule_sets (
  jurisdiction text not null,
  version text not null,
  effective_from date not null,
  effective_to date,
  is_production boolean not null default false,
  source_metadata jsonb not null default '[]'::jsonb,
  config_json jsonb not null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (jurisdiction, version)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_scope text not null default 'ALL',
  slug text not null unique,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 100
);
