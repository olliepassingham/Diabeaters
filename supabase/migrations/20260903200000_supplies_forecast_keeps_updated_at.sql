-- Forecast cache writes must not win last-write-wins over real stock edits.
-- `notify_supply_low` only patches days_remaining_cached / supply_forecast_at,
-- but the generic updated_at trigger treated those as newer than local inventory.

CREATE OR REPLACE FUNCTION public.set_supplies_stock_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.quantity IS NOT DISTINCT FROM OLD.quantity
    AND NEW.name IS NOT DISTINCT FROM OLD.name
    AND NEW.unit IS NOT DISTINCT FROM OLD.unit
    AND NEW.category IS NOT DISTINCT FROM OLD.category
    AND NEW.notes IS NOT DISTINCT FROM OLD.notes
    AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
  ) THEN
    NEW.updated_at = OLD.updated_at;
    RETURN NEW;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_supplies_updated_at ON public.supplies;
CREATE TRIGGER set_supplies_updated_at
BEFORE UPDATE ON public.supplies
FOR EACH ROW
EXECUTE FUNCTION public.set_supplies_stock_updated_at();
