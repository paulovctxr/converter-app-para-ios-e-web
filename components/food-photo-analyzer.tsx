"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeFoodPhoto,
  prepareFoodPhoto,
  type FoodPhotoAnalysis,
} from "@/lib/food-photo";
import { MEAL_LABELS, type MealType } from "@/lib/nutrition";

type Step = "choice" | "preview" | "analyzing" | "review";
type Draft = {
  label: string;
  meal_type: MealType;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};
type AnalyzeResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  analysis?: unknown;
};

const emptyDraft: Draft = {
  label: "",
  meal_type: "other",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
};

function number(value: string, min: number, max: number) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
}

async function errorPayload(error: unknown): Promise<AnalyzeResponse> {
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null;
  if (context instanceof Response) {
    try {
      return (await context.clone().json()) as AnalyzeResponse;
    } catch {
      return {};
    }
  }
  return {};
}

export function FoodPhotoAnalyzer({
  day,
  onSaved,
}: {
  day: string;
  onSaved: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("choice");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [analysis, setAnalysis] = useState<FoodPhotoAnalysis | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(selected: File | undefined) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setMessage("Escolha uma imagem da refeição.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      setMessage("A foto pode ter no máximo 15 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setAnalysis(null);
    setDraft(emptyDraft);
    setMessage("");
    setStep("preview");
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setAnalysis(null);
    setDraft(emptyDraft);
    setMessage("");
    setStep("choice");
  }

  async function analyze() {
    if (!file) return;
    setStep("analyzing");
    setMessage("");
    try {
      const image = await prepareFoodPhoto(file);
      const { data, error } =
        await createClient().functions.invoke<AnalyzeResponse>(
          "nutrition-ai-tools",
          { body: { action: "analyze_food_photo", image } },
        );
      if (error) {
        const payload = await errorPayload(error);
        throw new Error(
          payload.error || "Não conseguimos analisar a refeição agora.",
        );
      }
      const normalized = normalizeFoodPhoto(data?.analysis);
      setAnalysis(normalized);
      if (!data?.ok || !normalized.meal) {
        setStep("preview");
        setMessage(
          normalized.qualityIssues[0] ||
            "Não identificamos a comida com segurança. Tire outra foto.",
        );
        return;
      }
      setDraft({
        label: normalized.meal.label,
        meal_type: normalized.meal.meal_type,
        calories: String(normalized.meal.calories),
        protein_g: String(normalized.meal.protein_g),
        carbs_g: String(normalized.meal.carbs_g),
        fat_g: String(normalized.meal.fat_g),
      });
      setStep("review");
    } catch (error) {
      setStep("preview");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível analisar esta foto.",
      );
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !draft.label.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient()
        .from("summer_calorie_entries")
        .insert({
          day,
          label: draft.label.trim(),
          meal_type: draft.meal_type,
          calories: number(draft.calories, 1, 10000),
          protein_g: number(draft.protein_g, 0, 1000),
          carbs_g: number(draft.carbs_g, 0, 1500),
          fat_g: number(draft.fat_g, 0, 1000),
        });
      if (error) throw error;
      await onSaved();
      reset();
      setMessage("Refeição registrada pela foto.");
    } catch {
      setMessage("Não foi possível salvar esta refeição.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="food-photo-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">NOVIDADE COM IA</p>
          <h4>Registrar alimentação por foto</h4>
          <p>Fotografe o prato, confira a estimativa e confirme antes de salvar.</p>
        </div>
        <Camera size={24} />
      </div>

      <input
        ref={cameraInput}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      <input
        ref={galleryInput}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => choose(event.target.files?.[0])}
      />

      {step === "choice" && (
        <div className="food-photo-actions">
          <button className="primary-button" type="button" onClick={() => cameraInput.current?.click()}>
            <Camera size={18} /> TIRAR FOTO DA COMIDA
          </button>
          <button className="secondary-button" type="button" onClick={() => galleryInput.current?.click()}>
            <ImagePlus size={18} /> ESCOLHER DA GALERIA
          </button>
        </div>
      )}

      {(step === "preview" || step === "analyzing" || step === "review") && preview && (
        <div className="food-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Prévia da refeição escolhida" />
        </div>
      )}

      {step === "preview" && (
        <div className="food-photo-actions">
          <button className="primary-button" type="button" onClick={() => void analyze()}>
            <Sparkles size={18} /> ANALISAR COM IA
          </button>
          <button className="secondary-button" type="button" onClick={reset}>
            <RotateCcw size={18} /> TIRAR OUTRA
          </button>
        </div>
      )}

      {step === "analyzing" && (
        <div className="food-photo-loading" role="status">
          <LoaderCircle className="spin" size={24} />
          <strong>Analisando sua refeição...</strong>
          <span>Estimando alimentos, porção, calorias e macros.</span>
        </div>
      )}

      {step === "review" && analysis?.meal && (
        <form className="food-photo-review" onSubmit={save}>
          <div className="food-photo-review-heading">
            <Check size={18} />
            <div>
              <strong>Confira antes de registrar</strong>
              <span>Os valores são estimativas e podem ser ajustados.</span>
            </div>
          </div>
          {(analysis.meal.confidence === "low" || analysis.quality === "low") && (
            <p className="food-photo-warning"><AlertTriangle size={16} /> Verifique com atenção os campos abaixo.</p>
          )}
          <div className="food-photo-fields">
            <label className="wide-field">Alimento ou refeição<input required maxLength={100} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
            <label>Tipo<select value={draft.meal_type} onChange={(event) => setDraft({ ...draft, meal_type: event.target.value as MealType })}>{Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Calorias<input required type="number" min={1} max={10000} value={draft.calories} onChange={(event) => setDraft({ ...draft, calories: event.target.value })} /></label>
            <label>Proteína (g)<input type="number" min={0} max={1000} step="0.1" value={draft.protein_g} onChange={(event) => setDraft({ ...draft, protein_g: event.target.value })} /></label>
            <label>Carboidratos (g)<input type="number" min={0} max={1500} step="0.1" value={draft.carbs_g} onChange={(event) => setDraft({ ...draft, carbs_g: event.target.value })} /></label>
            <label>Gorduras (g)<input type="number" min={0} max={1000} step="0.1" value={draft.fat_g} onChange={(event) => setDraft({ ...draft, fat_g: event.target.value })} /></label>
          </div>
          {analysis.meal.notes && <p className="food-photo-note">{analysis.meal.notes}</p>}
          <div className="food-photo-actions">
            <button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />} CONFIRMAR E REGISTRAR</button>
            <button className="secondary-button" type="button" disabled={saving} onClick={reset}>CANCELAR</button>
          </div>
        </form>
      )}

      {message && <p className={message.includes("registrada") ? "success-message" : "notice"}>{message}</p>}
      <small className="nutrition-disclaimer">A foto é usada somente durante a análise e não é armazenada. A IA fornece estimativas; revise porções, calorias e macros antes de confirmar.</small>
    </section>
  );
}
