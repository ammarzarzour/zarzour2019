-- Zarzour Travel operational foundation.
-- Tables start closed: RLS is enabled and no client access policies are created until
-- authentication, staff roles, and least-privilege rules are agreed and implemented.
create table public.travel_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  nationality text,
  passport_number text,
  passport_expiry date,
  date_of_birth date,
  notes text,
  lead_status text not null default 'new'
    check (lead_status in ('new','contacted','qualified','booked','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text,
  objective text,
  start_date date,
  end_date date,
  budget numeric(12,2),
  currency text not null default 'SAR',
  status text not null default 'planned'
    check (status in ('planned','active','paused','completed')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.travel_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_type text not null
    check (service_type in ('travel','visa','tourism','hajj','umrah')),
  destination text,
  start_date date,
  end_date date,
  capacity integer check (capacity is null or capacity >= 0),
  status text not null default 'draft'
    check (status in ('draft','open','full','completed','cancelled')),
  description text,
  created_at timestamptz not null default now()
);

create table public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text unique,
  customer_id uuid not null references public.travel_customers(id) on delete restrict,
  program_id uuid references public.travel_programs(id) on delete restrict,
  service_type text not null
    check (service_type in ('travel','visa','tourism','hajj','umrah')),
  status text not null default 'inquiry'
    check (status in ('inquiry','documents_pending','confirmed','in_progress','completed','cancelled')),
  departure_date date,
  return_date date,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.travel_guarantors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  resident_id_number text,
  national_address text,
  relationship text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.pilgrims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete restrict,
  customer_id uuid not null references public.travel_customers(id) on delete restrict,
  guarantor_id uuid references public.travel_guarantors(id) on delete set null,
  campaign_group text,
  supervisor_name text,
  supervisor_phone text,
  bus_number text,
  seat_number text,
  manifest_reference text,
  departure_confirmed_at timestamptz,
  return_confirmed_at timestamptz,
  status text not null default 'registered'
    check (status in ('registered','documents_pending','ready','departed','returned','exception')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.travel_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_reference text unique,
  booking_id uuid references public.travel_bookings(id) on delete restrict,
  partner_id uuid,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','under_review','signed','completed','cancelled')),
  effective_date date,
  expiry_date date,
  private_storage_path text,
  terms_summary text,
  created_at timestamptz not null default now()
);

create table public.travel_partners (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  partner_type text not null
    check (partner_type in ('company','agency','agent','transport','hotel','other')),
  country text,
  city text,
  contact_name text,
  phone text,
  email text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','in_review','verified','rejected')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.travel_contracts
  add constraint travel_contracts_partner_id_fkey
  foreign key (partner_id) references public.travel_partners(id) on delete restrict;

create table public.travel_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.travel_partners(id) on delete restrict,
  booking_id uuid references public.travel_bookings(id) on delete restrict,
  commission_rate numeric(7,4) check (commission_rate is null or commission_rate between 0 and 100),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  status text not null default 'pending'
    check (status in ('pending','approved','settled','cancelled')),
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.travel_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('debit','credit')),
  account_code text,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  reference text,
  status text not null default 'draft'
    check (status in ('draft','posted','void')),
  created_at timestamptz not null default now()
);

create index travel_customers_phone_idx on public.travel_customers(phone);
create index travel_bookings_customer_idx on public.travel_bookings(customer_id);
create index travel_bookings_status_idx on public.travel_bookings(status);
create index pilgrims_booking_idx on public.pilgrims(booking_id);
create index pilgrims_status_idx on public.pilgrims(status);
create index travel_partners_type_idx on public.travel_partners(partner_type);
create index travel_contracts_booking_idx on public.travel_contracts(booking_id);
create index travel_commissions_partner_idx on public.travel_commissions(partner_id);
create index travel_ledger_date_idx on public.travel_ledger_entries(entry_date);

alter table public.travel_customers enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.travel_programs enable row level security;
alter table public.travel_bookings enable row level security;
alter table public.travel_guarantors enable row level security;
alter table public.pilgrims enable row level security;
alter table public.travel_contracts enable row level security;
alter table public.travel_partners enable row level security;
alter table public.travel_commissions enable row level security;
alter table public.travel_ledger_entries enable row level security;

comment on schema public is 'Zarzour Travel application tables; client access remains blocked until explicit auth and least-privilege policies are added.';
