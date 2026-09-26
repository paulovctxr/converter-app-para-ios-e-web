"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  Crown,
  Droplets,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
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

type Entry = { id: string; label: string; calories: number };

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function date(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";
}

export function PlanPanel({
  access,
  onRefresh,
}: {
  access: Access | null;
  onRefresh: () => void;
}) {
  const [config, setConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [selectedPlan, setSelectedPlan] =
    useState<SubscriptionPlan>("annual");
  const [request, setRequest] = useState<SubscriptionRequest | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [day, setDay] = useState(today);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [label, setLabel] = useState("");
  const [calories, setCalories] = useState("");
  const [busy, setBusy] = useState(false);
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

  const loadEntries = useCallback(async () => {
    if (!paid) {
      setEntries([]);
      return;
    }
    try {
      const { data, error } = await createClient()
        .from("summer_calorie_entries")
        .select("id,label,calories")
        .eq("day", day)
        .order("created_at");
      if (error) throw error;
      setEntries(data || []);
    } catch {
      setMessage("Não foi possível carregar seus registros. Tente novamente.");
      setEntries([]);
    }
  }, [day, paid]);

  useEffect(() => {
    void loadPlanData();
  }, [loadPlanData]);
  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

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

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !label.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient()
        .from("summer_calorie_entries")
        .insert({ day, label: label.trim(), calories: Number(calories) });
      if (error) throw error;
      setLabel("");
      setCalories("");
      await loadEntries();
    } catch {
      setMessage(
        "Não foi possível salvar. Confira sua conexão e se o Summer PRO continua ativo.",
      );
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy || !window.confirm("Excluir este registro?")) return;
    setBusy(true);
    try {
      const { data, error } = await createClient()
        .from("summer_calorie_entries")
        .delete()
        .eq("id", id)
        .select("id");
      if (error || !data?.length) throw error;
      await loadEntries();
    } catch {
      setMessage(
        "Não foi possível excluir. Verifique a conexão e a validade do plano.",
      );
      onRefresh();
    } finally {
      setBusy(false);
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
      <header className="pro-page-hero">
        <div className="pro-hero-icon">
          <Crown size={30} />
        </div>
        <div>
          <p className="eyebrow">SUMMER PRO</p>
          <h2 className="panel-title">Evolua dentro e fora do treino.</h2>
          <p>
            Seu treino da academia continua gratuito. O PRO adiciona nutrição,
            análises e uma visão mais completa da sua evolução.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setMessage("");
            onRefresh();
            void loadPlanData();
          }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </header>

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
          <span className="best-value">MELHOR CUSTO-BENEFÍCIO</span>
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
              onClick={() => setSelectedPlan("monthly")}
              type="button"
            >
              Mensal
            </button>
            <button
              className={selectedPlan === "annual" ? "active" : ""}
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
            <p className="annual-saving">Oferta promocional ativa</p>
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
            className="primary-button full-button pro-subscribe"
            onClick={() => setCheckoutOpen(true)}
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

      {checkoutOpen && (
        <section className="pix-checkout" aria-labelledby="pix-title">
          <div className="pix-checkout-heading">
            <div className="pix-icon">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="eyebrow">PAGAMENTO SEGURO</p>
              <h3 id="pix-title">
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
          <code>{config.pix_key}</code>
          <button className="secondary-button" onClick={() => void copyPix()}>
            <Copy size={16} />
            Copiar chave PIX
          </button>
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
            O frontend não libera assinaturas. A confirmação acontece no banco
            após a conferência do pagamento.
          </small>
        </section>
      )}

      <div role="status" aria-live="polite">
        {message && <p className="notice">{message}</p>}
      </div>

      {paid ? (
        <section className="calorie-card nutrition-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NUTRIÇÃO SUMMER PRO</p>
              <h3>
                {entries.reduce((total, entry) => total + entry.calories, 0)}{" "}
                kcal registradas
              </h3>
              <p>
                Seu registro nutricional atual permanece disponível enquanto os
                novos recursos inteligentes são adicionados.
              </p>
            </div>
            <label>
              Dia
              <input
                type="date"
                required
                value={day}
                onChange={(event) => event.target.value && setDay(event.target.value)}
              />
            </label>
          </div>
          <form className="calorie-form" onSubmit={add}>
            <label>
              Alimento ou refeição
              <input
                required
                maxLength={100}
                placeholder="Ex.: Almoço"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label>
              Calorias (kcal)
              <input
                required
                type="number"
                min={1}
                max={10000}
                value={calories}
                onChange={(event) => setCalories(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={busy}>
              <Plus size={16} />
              ADICIONAR
            </button>
          </form>
          <div className="workout-list">
            {entries.map((entry) => (
              <div className="workout-row" key={entry.id}>
                <Check size={18} />
                <div className="workout-copy">
                  <strong>{entry.label}</strong>
                  <span>{entry.calories} kcal</span>
                </div>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={`Excluir ${entry.label}`}
                  onClick={() => void remove(entry.id)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
          {!entries.length && <p>Nenhum registro neste dia.</p>}
        </section>
      ) : (
        <section className="pro-preview-card">
          <div className="pro-preview-icon">
            <Sparkles size={26} />
          </div>
          <div>
            <p className="eyebrow">EXCLUSIVO SUMMER PRO</p>
            <h3>Nutrição com Inteligência Artificial</h3>
            <p>
              Cardápio de 7 dias, metas de calorias e macros, controle de água
              e lista de compras em uma experiência integrada.
            </p>
            <div className="preview-pills">
              <span>
                <Utensils size={15} /> Cardápio personalizado
              </span>
              <span>
                <Droplets size={15} /> Controle de água
              </span>
            </div>
          </div>
          <button
            className="primary-button"
            onClick={() => setCheckoutOpen(true)}
          >
            CONHECER SUMMER PRO
          </button>
        </section>
      )}
    </section>
  );
}
