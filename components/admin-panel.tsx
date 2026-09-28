"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import dynamic from 'next/dynamic';
const CommunityAdmin = dynamic(() => import('./community-admin').then(module => module.CommunityAdmin));
import {
  DEFAULT_PLAN_CONFIG,
  formatBRL,
  monthlyPrice,
  subscriptionPlanLabel,
  type PlanConfig,
  type SubscriptionPlan,
} from "@/lib/plans";

type Student = {
  id: string;
  name: string;
  email: string;
  registration: string;
  created_at: string;
  confirmed: boolean;
  plan: "basic" | "premium" | "plus";
  expires_at: string | null;
  subscription_status: "free" | "pro" | "expired" | "cancelled";
  subscription_plan: SubscriptionPlan | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  subscription_updated_at: string | null;
  pending_request: {
    id: number;
    subscription_plan: SubscriptionPlan;
    amount_cents: number;
    status: "pending";
    created_at: string;
  } | null;
};
type Overview = {
  students: Student[];
  total: number;
  summary: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    basic: number;
    free: number;
    pro: number;
    cancelled: number;
  };
  server_time: string;
};
type ImportConfig = {
  monthly_limit: number;
  free_trial_limit: number;
  updated_at: string;
};
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";
}
export function AdminPanel() {
  const [result, setResult] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [importConfig, setImportConfig] = useState<ImportConfig | null>(null);
  const [planConfig, setPlanConfig] =
    useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [configBusy, setConfigBusy] = useState(false);
  const [choices, setChoices] = useState<Record<string, SubscriptionPlan>>({});
  const request = useRef(0);
  const changing = useRef(false);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const supabase = createClient();
      const [students, config, pricing] = await Promise.all([
        supabase.rpc("summer_admin_students", {
          p_search: search,
          p_status: status,
          p_page: page,
        }),
        supabase.rpc("summer_admin_workout_import_config"),
        supabase.rpc("summer_get_plan_config"),
      ]);
      if (id !== request.current) return;
      if (students.error) throw students.error;
      setResult(students.data as Overview);
      if (!config.error && config.data) setImportConfig(config.data as ImportConfig);
      if (!pricing.error && pricing.data)
        setPlanConfig(pricing.data as PlanConfig);
    } catch {
      if (id === request.current) {
        setResult(null);
        setMessage(
          "Não foi possível carregar os alunos. Confira sua conexão e tente atualizar.",
        );
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [search, status, page]);
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  async function changePlan(
    student: Student,
    action: "grant" | "renew" | "revoke",
  ) {
    if (changing.current) return;
    const plan = choices[student.id] || student.subscription_plan || "monthly";
    const description =
      action === "revoke"
        ? `Cancelar o Summer PRO de ${student.name || student.email} agora?`
        : action === "renew"
          ? `Renovar o Summer PRO no ${subscriptionPlanLabel(plan).toLowerCase()} para ${student.name || student.email}? Dias ainda válidos serão preservados. Confirme apenas após verificar o pagamento.`
          : `Liberar o Summer PRO no ${subscriptionPlanLabel(plan).toLowerCase()} para ${student.name || student.email}? Confirme apenas após verificar o pagamento.`;
    if (!window.confirm(description)) return;
    changing.current = true;
    setBusy(student.id);
    setMessage("");
    try {
      const { error } = await createClient().rpc(
        "summer_admin_set_subscription",
        {
        p_user_id: student.id,
          p_subscription_plan: plan,
        p_action: action,
        },
      );
      if (error) throw error;
      setMessage(
        action === "revoke"
          ? "Acesso pago revogado."
          : "Plano atualizado. A nova validade já está salva.",
      );
      await load();
    } catch {
      setMessage(
        "Não foi possível confirmar a alteração. Atualize a lista e confira a validade antes de tentar novamente.",
      );
    } finally {
      changing.current = false;
      setBusy(null);
    }
  }
  async function reviewRequest(
    student: Student,
    decision: "approved" | "rejected",
  ) {
    const pending = student.pending_request;
    if (!pending || changing.current) return;
    const verb = decision === "approved" ? "aprovar" : "recusar";
    if (
      !window.confirm(
        `${verb[0].toUpperCase()}${verb.slice(1)} o pagamento de ${formatBRL(pending.amount_cents)} enviado por ${student.name || student.email}?${decision === "approved" ? " Confirme somente após conferir o comprovante e o recebimento no banco." : ""}`,
      )
    )
      return;
    changing.current = true;
    setBusy(`request-${pending.id}`);
    setMessage("");
    try {
      const { error } = await createClient().rpc(
        "summer_admin_review_subscription_request",
        { p_request_id: pending.id, p_decision: decision },
      );
      if (error) throw error;
      setMessage(
        decision === "approved"
          ? "Pagamento aprovado e Summer PRO liberado."
          : "Solicitação recusada sem alterar o plano do aluno.",
      );
      await load();
    } catch {
      setMessage(
        "Não foi possível analisar essa solicitação. Atualize a lista e tente novamente.",
      );
    } finally {
      changing.current = false;
      setBusy(null);
    }
  }
  async function saveImportConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importConfig || configBusy) return;
    setConfigBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc(
        "summer_admin_workout_import_config",
        {
          p_monthly_limit: importConfig.monthly_limit,
          p_free_trial_limit: null,
        },
      );
      if (error) throw error;
      setImportConfig(data as ImportConfig);
      setMessage("Limites de digitalização atualizados.");
    } catch {
      setMessage("Não foi possível atualizar os limites de digitalização.");
    } finally {
      setConfigBusy(false);
    }
  }
  const summary = result?.summary;
  return (
    <main className="admin-shell">
      <header className="admin-top">
        <a href="/" className="secondary-button">
          <ArrowLeft size={16} />
          Voltar ao app
        </a>
        <span>
          <ShieldCheck size={18} />
          Área exclusiva do administrador
        </span>
      </header>
      <section className="admin-content">
        <details className="community-admin-section"><summary>Comunidade: aprovar alunos, moderar stories e criar desafios</summary><CommunityAdmin /></details>
        <p className="eyebrow">SUMMER FIT / ADMINISTRAÇÃO</p>
        <div className="section-heading admin-heading">
          <div>
            <h1>Alunos e planos</h1>
            <p>Uma visão completa de quem treina com você.</p>
          </div>
          <button
            className="secondary-button"
            disabled={loading || Boolean(busy)}
            onClick={() => {
              setMessage("");
              void load();
            }}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
        <div className="admin-stats">
          <article>
            <Users size={21} />
            <span>Alunos cadastrados</span>
            <strong>{summary?.total ?? "—"}</strong>
          </article>
          <article>
            <Check size={21} />
            <span>Planos ativos</span>
            <strong>{summary?.active ?? "—"}</strong>
          </article>
          <article>
            <CalendarDays size={21} />
            <span>Vencem em até 7 dias</span>
            <strong>{summary?.expiring ?? "—"}</strong>
          </article>
          <article>
            <CalendarDays size={21} />
            <span>Planos vencidos</span>
            <strong>{summary?.expired ?? "—"}</strong>
          </article>
        </div>
        {importConfig && (
          <form className="admin-import-config" onSubmit={saveImportConfig}>
            <div className="admin-import-copy">
              <ScanLine size={24} />
              <div>
                <h2>Importação por foto</h2>
                <p>
                  A digitalização faz parte do Summer Grátis. Altere aqui a
                  cota mensal de todas as contas sem publicar uma nova versão.
                </p>
              </div>
            </div>
            <label>
              Digitalizações grátis / mês
              <input
                type="number"
                min={1}
                max={50}
                required
                value={importConfig.monthly_limit}
                onChange={(event) =>
                  setImportConfig({
                    ...importConfig,
                    monthly_limit: Number(event.target.value),
                  })
                }
              />
            </label>
            <button className="primary-button" disabled={configBusy}>
              {configBusy ? "SALVANDO..." : "SALVAR LIMITES"}
            </button>
          </form>
        )}
        <div role="status" aria-live="polite">
          {message && <p className="notice">{message}</p>}
        </div>
        <section
          className="admin-table-card"
          aria-label="Gerenciamento dos alunos"
        >
          <div className="admin-filters">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPage(0);
                setSearch(query.trim());
              }}
            >
              <label className="sr-only" htmlFor="student-search">
                Buscar por nome, e-mail ou matrícula
              </label>
              <Search size={18} />
              <input
                id="student-search"
                type="search"
                maxLength={120}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome, e-mail ou matrícula"
              />
              <button className="secondary-button" type="submit">
                Buscar
              </button>
            </form>
            <label>
              Situação
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Todos os alunos</option>
                <option value="pro">Summer PRO ativo</option>
                <option value="expiring">Vencem em até 7 dias</option>
                <option value="expired">Planos vencidos</option>
                <option value="cancelled">Planos cancelados</option>
                <option value="free">Summer Grátis</option>
              </select>
            </label>
          </div>
          <p className="admin-note">
            A renovação é manual: a data indica até quando o acesso está
            liberado. Nenhuma cobrança é feita automaticamente.
          </p>
          <div className="table-scroll" aria-busy={loading}>
            <table>
              <caption className="sr-only">
                Alunos, planos, vencimentos e ações administrativas
              </caption>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Matrícula</th>
                  <th>Plano</th>
                  <th>Renovação até</th>
                  <th>Situação</th>
                  <th>Gerenciar acesso</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      Carregando alunos...
                    </td>
                  </tr>
                ) : result?.students.length ? (
                  result.students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.name || "Nome não informado"}</strong>
                        <small>{student.email}</small>
                        <small>
                          Cadastro: {date(student.created_at)}
                          {!student.confirmed && " · E-mail pendente"}
                        </small>
                      </td>
                      <td>{student.registration || "Não informada"}</td>
                      <td>
                        <span
                          className={`plan-badge ${student.subscription_status === "pro" ? "plus" : "basic"}`}
                        >
                          {student.subscription_status === "pro"
                            ? "Summer PRO"
                            : "Summer Grátis"}
                        </span>
                        {student.subscription_plan && (
                          <small>
                            {subscriptionPlanLabel(student.subscription_plan)}
                          </small>
                        )}
                      </td>
                      <td>
                        <strong>{date(student.subscription_expires_at)}</strong>
                        {student.subscription_expires_at && (
                          <small>
                            {new Date(
                              student.subscription_expires_at,
                            ).toLocaleTimeString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · Brasília
                          </small>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${student.subscription_status === "pro" ? "active" : student.subscription_status}`}
                        >
                          {student.subscription_status === "pro"
                            ? "PRO ativo"
                            : student.subscription_status === "expired"
                              ? "Vencido"
                              : student.subscription_status === "cancelled"
                                ? "Cancelado"
                                : "Gratuito"}
                        </span>
                        {student.subscription_status === "pro" &&
                          student.subscription_expires_at &&
                          new Date(student.subscription_expires_at).getTime() -
                            new Date(result.server_time).getTime() <=
                            7 * 86400000 && (
                            <small className="expiring-text">
                              Vence em breve
                            </small>
                          )}
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          {student.pending_request && (
                            <div className="pending-request-card">
                              <strong>PIX aguardando conferência</strong>
                              <span>
                                {subscriptionPlanLabel(
                                  student.pending_request.subscription_plan,
                                )}{" "}
                                · {formatBRL(student.pending_request.amount_cents)}
                              </span>
                              <div>
                                <button
                                  className="primary-button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void reviewRequest(student, "approved")
                                  }
                                >
                                  {busy ===
                                  `request-${student.pending_request.id}`
                                    ? "SALVANDO..."
                                    : "APROVAR PIX"}
                                </button>
                                <button
                                  className="revoke-button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void reviewRequest(student, "rejected")
                                  }
                                >
                                  Recusar
                                </button>
                              </div>
                            </div>
                          )}
                          <select
                            aria-label={`Plano para ${student.name || student.email}`}
                            value={
                              choices[student.id] ||
                              student.pending_request?.subscription_plan ||
                              student.subscription_plan ||
                              "monthly"
                            }
                            disabled={Boolean(busy)}
                            onChange={(e) =>
                              setChoices((current) => ({
                                ...current,
                                [student.id]: e.target.value as SubscriptionPlan,
                              }))
                            }
                          >
                            <option value="monthly">
                              PRO mensal · {formatBRL(monthlyPrice(planConfig))}
                            </option>
                            <option value="annual">
                              PRO anual · {formatBRL(planConfig.pro_annual_price_cents)}
                            </option>
                          </select>
                          <button
                            className="primary-button"
                            disabled={Boolean(busy) || !student.confirmed}
                            onClick={() => void changePlan(student, "grant")}
                          >
                            {busy === student.id
                              ? "SALVANDO..."
                              : (choices[student.id] ||
                                    student.subscription_plan ||
                                    "monthly") === "annual"
                                ? "LIBERAR 1 ANO"
                                : "LIBERAR 1 MÊS"}
                          </button>
                          {student.subscription_plan && (
                            <button
                              className="secondary-button"
                              disabled={Boolean(busy) || !student.confirmed}
                              onClick={() => void changePlan(student, "renew")}
                            >
                              Renovar período
                            </button>
                          )}
                          {student.subscription_status === "pro" && (
                            <button
                              className="revoke-button"
                              disabled={Boolean(busy)}
                              onClick={() => void changePlan(student, "revoke")}
                            >
                              Revogar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      {result
                        ? "Nenhum aluno encontrado com esses filtros."
                        : "A lista não está disponível. Tente atualizar."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {result
                ? `${result.total} aluno(s) · Página ${page + 1} de ${Math.max(1, Math.ceil(result.total / 20))}`
                : "—"}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={page === 0 || loading || Boolean(busy)}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Próxima página"
                disabled={
                  !result ||
                  (page + 1) * 20 >= result.total ||
                  loading ||
                  Boolean(busy)
                }
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
        <p className="admin-note">
          Todas as liberações, renovações e revogações ficam registradas para
          auditoria. Apenas contas com e-mail confirmado podem receber um plano.
        </p>
      </section>
    </main>
  );
}
