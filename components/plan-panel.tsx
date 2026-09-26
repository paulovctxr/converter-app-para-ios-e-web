"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Crown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PIX_KEY, PLAN_NAMES, type Access } from "@/lib/plans";
type Entry = { id: string; label: string; calories: number };
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function PlanPanel({
  access,
  onRefresh,
}: {
  access: Access | null;
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState("");
  const [day, setDay] = useState(today);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [label, setLabel] = useState("");
  const [calories, setCalories] = useState("");
  const [busy, setBusy] = useState(false);
  const paid = access?.plan === "premium" || access?.plan === "plus";
  const load = useCallback(async () => {
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
      setMessage(
        "Não foi possível carregar seus registros. Confira sua conexão.",
      );
      setEntries([]);
    }
  }, [day, paid]);
  useEffect(() => {
    void load();
  }, [load]);
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
      await load();
    } catch {
      setMessage(
        "Não foi possível salvar. Confira sua conexão e se o plano continua ativo.",
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
      await load();
    } catch {
      setMessage(
        "Não foi possível excluir. Verifique sua conexão e a validade do plano.",
      );
      onRefresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tab-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEU ACESSO SUMMER FIT</p>
          <h2 className="panel-title">Meu plano</h2>
          <p>
            {access
              ? `${PLAN_NAMES[access.plan]}${access.plan !== "basic" && access.expires_at ? ` · válido até ${new Date(access.expires_at).toLocaleDateString("pt-BR")}` : ""}`
              : "Não foi possível consultar seu plano agora."}
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            setMessage("");
            onRefresh();
          }}
        >
          <RefreshCw size={16} />
          Atualizar acesso
        </button>
      </div>
      <div className="plan-summary">
        <Crown size={28} />
        <div>
          <h3>
            {paid
              ? "Seu plano está ativo."
              : "Liberação feita pela administração."}
          </h3>
          <p>
            {paid
              ? "Acompanhe a validade aqui. Sua renovação é confirmada manualmente após o pagamento."
              : "Premium: R$ 5 por mês. Summer PRO: R$ 8 por mês e inclui a importação de fichas por foto. Consulte a administração antes de pagar."}
          </p>
        </div>
      </div>
      {access && (
        <div className="pix-card">
          <h3>Pagamento via Pix</h3>
          <p>
            Após pagar, informe à academia o e-mail da sua conta e apresente o
            comprovante. O Pix não libera o plano automaticamente.
          </p>
          <code>{PIX_KEY}</code>
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(PIX_KEY);
                setMessage("Chave Pix copiada.");
              } catch {
                setMessage(
                  "Não foi possível copiar. Selecione a chave acima para copiar manualmente.",
                );
              }
            }}
          >
            <Copy size={16} />
            Copiar chave Pix
          </button>
        </div>
      )}
      <div role="status">{message && <p className="notice">{message}</p>}</div>
      {paid ? (
        <section className="calorie-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">REGISTRO DE CALORIAS</p>
              <h3>
                {entries.reduce((total, entry) => total + entry.calories, 0)}{" "}
                kcal registradas
              </h3>
            </div>
            <label>
              Dia
              <input
                type="date"
                required
                value={day}
                onChange={(e) => {
                  if (e.target.value) setDay(e.target.value);
                }}
              />
            </label>
          </div>
          <p>Adicione os valores informados nas porções que você consumiu.</p>
          <form className="calorie-form" onSubmit={add}>
            <label>
              Alimento ou refeição
              <input
                required
                maxLength={100}
                placeholder="Ex.: Almoço"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
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
                onChange={(e) => setCalories(e.target.value)}
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
        <div className="empty-state">
          <Crown size={26} />
          <h3>Registro de calorias</h3>
          <p>
            Disponível com Premium ou Summer PRO ativo. O acesso é conferido na
            sua conta.
          </p>
        </div>
      )}
    </section>
  );
}
