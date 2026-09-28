-- Ativa a promoção de lançamento do Summer PRO.
-- A solicitação mensal usa R$ 10,00 durante a promoção ativa.
begin;

update summer_private.plan_config
set promotional_monthly_price_cents = 1000,
    promotion_active = true,
    updated_at = now()
where singleton = true;

commit;
