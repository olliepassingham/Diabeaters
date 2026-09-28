-- Keep the device's appointment updated_at when the client sends one.
-- The previous trigger always stamped now(), so a sync that started before an edit
-- could land afterwards and look newer than the edit supporters should see.

create or replace function public.set_appointments_updated_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.updated_at is null then
      new.updated_at := now();
    end if;
    return new;
  end if;

  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before insert or update on public.appointments
for each row
execute function public.set_appointments_updated_at();
