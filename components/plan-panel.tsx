"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Crown,
  MessageCircle,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PLAN_CONFIG,
  FREE_FEATURES,
  PRO_FEATURES,
  effectiveExpiresAt,
  formatBRL,
  isProAccess,
  monthlyPrice,
  subscriptionPlanLabel,
  type Access,
  type PlanConfig,
  type SubscriptionPlan,
  type SubscriptionRequest,
} from "@/lib/plans";

function date(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";
}

export function PlanPanel({
  access,
  onOpenNutrition,
}: {
  access: Access | null;
  onOpenNutrition: () => void;
}) {
  const [config, setConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [selectedPlan, setSelectedPlan] =
    useState<SubscriptionPlan>("monthly");
  const [request, setRequest] = useState<SubscriptionRequest | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const checkoutTitleRef = useRef<HTMLHeadingElement>(null);
  const subscribeButtonRef = useRef<HTMLButtonElement>(null);
  const paid = isProAccess(access);

  const loadPlanData = useCallback(async () => {
    const supabase = createClient();
    try {
      const [planConfig, pending] = await Promise.all([
        supabase.rpc("summer_get_plan_config"),
        supabase
          .from("summer_subscription_requests")
          .select("id,subscription_plan,amount_cents,status,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!planConfig.error && planConfig.data)
        setConfig(planConfig.data as PlanConfig);
      if (!pending.error && pending.data) {
        const current = pending.data as SubscriptionRequest;
        setRequest(current);
        setSelectedPlan(current.subscription_plan);
        setCheckoutOpen(true);
      } else if (!pending.error) {
        setRequest(null);
      }
    } catch {
      // The local defaults keep the pricing screen usable during brief outages.
    }
  }, []);

  useEffect(() => {
    void loadPlanData();
  }, [loadPlanData]);

  useEffect(() => {
    if (!checkoutOpen) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    checkoutTitleRef.current?.focus({ preventScroll: true });
  }, [checkoutOpen]);

  function returnToPlans() {
    setCheckoutOpen(false);
    setMessage("");
    window.requestAnimationFrame(() => subscribeButtonRef.current?.focus());
  }

  async function requestReview() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc(
        "summer_request_subscription",
        { p_subscription_plan: selectedPlan },
      );
      if (error || !data?.request_id) throw error;
      setRequest({
        id: Number(data.request_id),
        subscription_plan: data.subscription_plan as SubscriptionPlan,
        amount_cents: Number(data.amount_cents),
        status: "pending",
        created_at: new Date().toISOString(),
      });
      setMessage(
        "Solicitação enviada. O Summer PRO será liberado somente após a conferência do pagamento pelo administrador.",
      );
    } catch {
      setMessage(
        "Não foi possível enviar a solicitação. Confira sua conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(config.pix_key);
      setMessage("Chave PIX copiada.");
    } catch {
      setMessage(
        "Não foi possível copiar. Selecione a chave abaixo e copie manualmente.",
      );
    }
  }

  const checkoutPlan = request?.subscription_plan || selectedPlan;
  const checkoutAmount =
    request?.amount_cents ||
    (checkoutPlan === "annual"
      ? config.pro_annual_price_cents
      : monthlyPrice(config));

  return (
    <section className="tab-panel pro-page">
      {!checkoutOpen && (
        <>
          {paid && <div className="subscription-tools-link"><div><strong>Seu espaço PRO está liberado</strong><p>Acesse seu cardápio, água, diário e biblioteca na aba Nutrição.</p></div><button className="primary-button" onClick={onOpenNutrition}><Utensils size={17} />Abrir meus recursos</button></div>}

          {paid && (
            <div className="subscription-section-heading">
              <p className="eyebrow">SUA ASSINATURA</p>
              <h3>Plano e renovação</h3>
            </div>
          )}

          <div className="pricing-grid">
            <article className="pricing-card free-card">
              <div className="pricing-card-top">
                <div>
                  <span className="plan-kicker">PARA TREINAR</span>
                  <h3>Summer Grátis</h3>
                </div>
                {!paid && <span className="current-plan-badge">Plano atual</span>}
              </div>
              <div className="plan-price">
                <strong>{formatBRL(config.free_price_cents)}</strong>
                <span>para sempre</span>
              </div>
              <p className="plan-message">
                Seu treino da academia, agora no celular.
              </p>
              <ul className="feature-list">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature}>
                    <Check size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>

            <article className="pricing-card pro-card">
              <span className="best-value">{selectedPlan === "annual" ? "MELHOR CUSTO-BENEFÍCIO · ANUAL" : "SEU PRÓXIMO PASSO"}</span>
              <div className="pricing-card-top">
                <div>
                  <span className="plan-kicker">⭐ EXPERIÊNCIA COMPLETA</span>
                  <h3>Summer PRO</h3>
                </div>
                {paid && <span className="current-plan-badge dark">Plano atual</span>}
              </div>
              <div className="billing-toggle" aria-label="Escolha a periodicidade">
                <button
                  className={selectedPlan === "monthly" ? "active" : ""}
                  aria-pressed={selectedPlan === "monthly"}
                  onClick={() => setSelectedPlan("monthly")}
                  type="button"
                >
                  Mensal
                </button>
                <button
                  className={selectedPlan === "annual" ? "active" : ""}
                  aria-pressed={selectedPlan === "annual"}
                  onClick={() => setSelectedPlan("annual")}
                  type="button"
                >
                  Anual
                </button>
              </div>
              <div className="plan-price pro-price">
                <strong>
                  {formatBRL(
                    selectedPlan === "annual"
                      ? config.pro_annual_price_cents
                      : monthlyPrice(config),
                  )}
                </strong>
                <span>{selectedPlan === "annual" ? "/ano" : "/mês"}</span>
              </div>
              {selectedPlan === "annual" && (
                <p className="annual-saving">
                  Economize {formatBRL(config.annual_savings_cents)} no plano anual.
                </p>
              )}
              {config.promotion_active && selectedPlan === "monthly" && (
                <p className="annual-saving">
                  Promoção de lançamento · 1º mês por {formatBRL(config.promotional_monthly_price_cents)}
                </p>
              )}
              <ul className="feature-list pro-features">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature}>
                    <Check size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                ref={subscribeButtonRef}
                type="button"
                className="primary-button full-button pro-subscribe"
                onClick={() => {
                  setMessage("");
                  setCheckoutOpen(true);
                }}
              >
                <Crown size={17} />
                {paid ? "RENOVAR SUMMER PRO" : "ASSINAR SUMMER PRO"}
              </button>
              {paid && (
                <p className="active-until">
                  {subscriptionPlanLabel(access?.subscription_plan)} · válido até{" "}
                  {date(effectiveExpiresAt(access))}
                </p>
              )}
            </article>
          </div>
        </>
      )}

      {checkoutOpen && (
        <>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={returnToPlans}
          >
            <ArrowLeft size={17} />
            Voltar aos planos
          </button>
          <section className="pix-checkout" aria-labelledby="pix-title">
            <div className="pix-checkout-heading">
              <div className="pix-icon">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="eyebrow">PAGAMENTO SEGURO</p>
                <h3 id="pix-title" ref={checkoutTitleRef} tabIndex={-1}>
                  {request ? "Pagamento aguardando conferência" : "Assinar via PIX"}
                </h3>
              </div>
            </div>
            <div className="pix-order-summary">
              <span>{subscriptionPlanLabel(checkoutPlan)}</span>
              <strong>{formatBRL(checkoutAmount)}</strong>
            </div>
            <p>
              Copie a chave, faça o pagamento no aplicativo do seu banco e envie o
              comprovante ao administrador informando o e-mail da sua conta.
            </p>
            <div className="pix-receiver-note">
              <strong>Sobre o pagamento</strong>
              <span>
                O valor do plano será recebido pelo recepcionista Paulo, da
                academia, que também é o desenvolvedor da aplicação. Depois do
                PIX, envie o comprovante para conferência.
              </span>
            </div>
            <code>{config.pix_key}</code>
            <button className="secondary-button" onClick={() => void copyPix()}>
              <Copy size={16} />
              Copiar chave PIX
            </button>
            <a
              className="secondary-button pix-whatsapp-button"
              href="https://wa.me/5521974312734?text=Ol%C3%A1%2C%20fiz%20o%20PIX%20do%20Summer%20PRO%20e%20vou%20enviar%20o%20comprovante.%20Meu%20e-mail%20no%20app%20%C3%A9%3A%20"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} />
              Enviar comprovante pelo WhatsApp
            </a>
            {request ? (
              <div className="pending-payment">
                <CalendarDays size={19} />
                <div>
                  <strong>Solicitação enviada</strong>
                  <span>
                    Seu plano só ficará PRO depois que o administrador conferir o
                    pagamento.
                  </span>
                </div>
              </div>
            ) : (
              <button
                className="primary-button full-button"
                disabled={busy}
                onClick={() => void requestReview()}
              >
                {busy ? "ENVIANDO..." : "JÁ FIZ O PIX — ENVIAR PARA ANÁLISE"}
              </button>
            )}
            <small>
              A liberação acontece após a conferência do pagamento. Não há
              cobrança automática no PIX.
            </small>
          </section>
        </>
      )}

      <div role="status" aria-live="polite">
        {message && <p className="notice">{message}</p>}
      </div>
    </section>
  );
}
