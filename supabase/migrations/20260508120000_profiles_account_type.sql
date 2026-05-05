-- Account persona: full patient tools vs community (learn + feed) vs legacy default.
alter table public.profiles
  add column if not exists account_type text not null default 'patient';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('patient', 'community'));

comment on column public.profiles.account_type is 'patient = Type 1 clinical tools; community = education, feed, tools subset';
