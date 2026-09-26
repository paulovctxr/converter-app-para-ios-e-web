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

type Student = {
  id: string;
  name: string;
  email: string;
  registration: string;
  created_at: string;
  confirmed: boolean;
  plan: "basic" | "premium" | "plus";
  expires_at: string | null;
  status: "basic" | "active" | "expired";
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
  };
  server_time: string;
};
type ImportConfig = {
  monthly_limit: number;
  free_trial_limit: number;
  updated_at: string;
};
const plans = { basic: "Básico", premium: "Premium", plus: "Summer PRO" };
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
  const [configBusy, setConfigBusy] = useState(false);
  const [choices, setChoices] = useState<Record<string, "premium" | "plus">>(
    {},
  );
  const request = useRef(0);
  const changing = useRef(false);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const supabase = createClient();
      const [students, config] = await Promise.all([
        supabase.rpc("summer_admin_students", {
          p_search: search,
          p_status: status,
          p_page: page,
        }),
        supabase.rpc("summer_admin_workout_import_config"),
      ]);
      if (id !== request.current) return;
      if (students.error) throw students.error;
      setResult(students.data as Overview);
      if (!config.error && config.data) setImportConfig(config.data as ImportConfig);
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
    const plan =
      choices[student.id] ||
      (student.plan === "basic" ? "premium" : student.plan);
    const description =
      action === "revoke"
        ? `Revogar o acesso pago de ${student.name || student.email} agora?`
        : action === "renew"
          ? `Renovar ${plans[student.plan]} por 1 mês para ${student.name || student.email}? Dias ainda válidos serão preservados. Confirme apenas após verificar o pagamento.`
          : `Liberar ${plans[plan]} por 1 mês para ${student.name || student.email}? Dias ainda válidos serão preservados. Confirme apenas após verificar o pagamento.`;
    if (!window.confirm(description)) return;
    changing.current = true;
    setBusy(student.id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("summer_admin_set_plan", {
        p_user_id: student.id,
        p_plan: plan,
        p_action: action,
      });
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
          p_free_trial_limit: importConfig.free_trial_limit,
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
                  Altere as cotas sem precisar publicar uma nova versão do app.
                  O Summer PRO usa o limite mensal; as outras contas recebem o
                  teste gratuito.
                </p>
              </div>
            </div>
            <label>
              Summer PRO / mês
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
            <label>
              Teste gratuito
              <input
                type="number"
                min={0}
                max={5}
                required
                value={importConfig.free_trial_limit}
                onChange={(event) =>
                  setImportConfig({
                    ...importConfig,
                    free_trial_limit: Number(event.target.value),
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
                <option value="active">Planos ativos</option>
                <option value="expiring">Vencem em até 7 dias</option>
                <option value="expired">Planos vencidos</option>
                <option value="basic">Plano básico</option>
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
                        <span className={`plan-badge ${student.plan}`}>
                          {plans[student.plan]}
                        </span>
                      </td>
                      <td>
                        <strong>{date(student.expires_at)}</strong>
                        {student.expires_at && (
                          <small>
                            {new Date(student.expires_at).toLocaleTimeString(
                              "pt-BR",
                              {
                                timeZone: "America/Sao_Paulo",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}{" "}
                            · Brasília
                          </small>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${student.status}`}>
                          {student.status === "active"
                            ? "Ativo"
                            : student.status === "expired"
                              ? "Vencido"
                              : "Gratuito"}
                        </span>
                        {student.status === "active" &&
                          student.expires_at &&
                          new Date(student.expires_at).getTime() -
                            new Date(result.server_time).getTime() <=
                            7 * 86400000 && (
                            <small className="expiring-text">
                              Vence em breve
                            </small>
                          )}
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <select
                            aria-label={`Plano para ${student.name || student.email}`}
                            value={
                              choices[student.id] ||
                              (student.plan === "basic"
                                ? "premium"
                                : student.plan)
                            }
                            disabled={Boolean(busy)}
                            onChange={(e) =>
                              setChoices((current) => ({
                                ...current,
                                [student.id]: e.target.value as
                                  | "premium"
                                  | "plus",
                              }))
                            }
                          >
                            <option value="premium">Premium · R$ 5</option>
                            <option value="plus">Summer PRO · R$ 8</option>
                          </select>
                          <button
                            className="primary-button"
                            disabled={Boolean(busy) || !student.confirmed}
                            onClick={() => void changePlan(student, "grant")}
                          >
                            {busy === student.id
                              ? "SALVANDO..."
                              : "LIBERAR 1 MÊS"}
                          </button>
                          {student.plan !== "basic" && (
                            <button
                              className="secondary-button"
                              disabled={Boolean(busy) || !student.confirmed}
                              onClick={() => void changePlan(student, "renew")}
                            >
                              Renovar +1 mês
                            </button>
                          )}
                          {student.status === "active" && (
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
