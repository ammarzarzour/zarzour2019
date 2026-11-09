create table if not exists public.travel_visa_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique check (case_reference ~ '^[A-Za-z0-9/_-]{3,40}$'),
  booking_id uuid references public.travel_bookings(id) on delete set null,
  visa_type text not null check (visa_type in ('umrah','hajj','tourism','family','business','government')),
  destination text not null check (char_length(destination) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','documents','submitted','review','approved','rejected','closed')),
  target_date date not null,
  submitted_date date,
  passport_checked boolean not null default false,
  photo_checked boolean not null default false,
  application_checked boolean not null default false,
  itinerary_checked boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_visa_cases_submission_date_check check (
    status not in ('submitted','review','approved','rejected','closed') or submitted_date is not null
  )
);

alter table public.travel_visa_cases enable row level security;
comment on table public.travel_visa_cases is 'Travel-only visa case register. Client access remains denied until an authorized RLS model is approved.';
create index if not exists travel_visa_cases_status_idx on public.travel_visa_cases(status);
create index if not exists travel_visa_cases_target_date_idx on public.travel_visa_cases(target_date);
create index if not exists travel_visa_cases_booking_idx on public.travel_visa_cases(booking_id);

alter table public.travel_bookings
  add column if not exists travelers integer not null default 1 check (travelers between 1 and 500),
  add column if not exists supplier_reference text check (supplier_reference is null or char_length(supplier_reference) <= 80),
  add column if not exists supplier_confirmed boolean not null default false,
  add column if not exists documents_checked boolean not null default false,
  add column if not exists itinerary_issued boolean not null default false;

alter table public.travel_bookings drop constraint if exists travel_bookings_service_type_check;
alter table public.travel_bookings add constraint travel_bookings_service_type_check
  check (service_type in ('travel','visa','tourism','hajj','umrah','flight','hotel','transport','tour'));

alter table public.travel_bookings drop constraint if exists travel_bookings_status_check;
alter table public.travel_bookings add constraint travel_bookings_status_check
  check (status in ('inquiry','documents_pending','hold','confirmed','in_progress','in_service','completed','cancelled'));

comment on column public.travel_bookings.supplier_reference is 'Operational supplier reference only; no payment or personal document data.';
create index if not exists travel_bookings_departure_date_idx on public.travel_bookings(departure_date);

create table if not exists public.travel_accounting_journal (
  id uuid primary key default gen_random_uuid(),
  entry_reference text not null unique check (entry_reference ~ '^[A-Za-z0-9/_-]{3,40}$'),
  entry_date date not null default current_date,
  kind text not null check (kind in ('revenue','expense','commission','refund','adjustment')),
  status text not null default 'draft' check (status in ('draft','review','posted','void')),
  currency text not null check (currency in ('USD','SAR','SYP','EUR')),
  amount_minor bigint not null check (amount_minor > 0),
  debit_account text not null check (debit_account in ('cash','bank','receivable','payable','revenue','expense','commission','tax')),
  credit_account text not null check (credit_account in ('cash','bank','receivable','payable','revenue','expense','commission','tax')),
  evidence_checked boolean not null default false,
  approved_checked boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint travel_accounting_journal_distinct_accounts_check check (debit_account <> credit_account),
  constraint travel_accounting_journal_posted_check check (
    status <> 'posted' or (evidence_checked and approved_checked)
  )
);

alter table public.travel_accounting_journal enable row level security;
comment on table public.travel_accounting_journal is 'Double-entry operational register only. It never executes collections, transfers, or payments.';
create index if not exists travel_accounting_journal_date_idx on public.travel_accounting_journal(entry_date);
create index if not exists travel_accounting_journal_status_idx on public.travel_accounting_journal(status);

