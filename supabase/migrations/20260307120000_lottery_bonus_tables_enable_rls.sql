BEGIN;

ALTER TABLE public.lottery_bonus_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_bonus_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_cycle_bonus_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_bonus_instances ENABLE ROW LEVEL SECURITY;

COMMIT;
