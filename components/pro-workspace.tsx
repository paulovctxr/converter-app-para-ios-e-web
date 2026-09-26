"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Apple,
  BookOpen,
  CalendarDays,
  ChefHat,
  Droplets,
  Dumbbell,
  Gauge,
  ListChecks,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Utensils,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ACTIVITY_LABELS,
  DEFAULT_NUTRITION_PROFILE,
  DIET_LABELS,
  GOAL_LABELS,
  MEAL_LABELS,
  calculateNutritionTargets,
  localDateValue,
  nutritionTotals,
  progressPercent,
  readMealPlan,
  type ActivityLevel,
  type DietaryPreference,
  type ExerciseLibraryItem,
  type MealPlan,
  type MealType,
  type NutritionAccess,
  type NutritionEntry,
  type NutritionGoal,
  type NutritionProfile,
  type WaterEntry,
} from "@/lib/nutrition";

type Tool = "overview" | "menu" | "diary" | "shopping" | "library";
type FoodDraft = {
  label: string;
  meal_type: MealType;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};

const emptyFood: FoodDraft = {
  label: "",
  meal_type: "lunch",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
};

const tools = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "menu", label: "Cardápio", icon: ChefHat },
  { id: "diary", label: "Diário e água", icon: Droplets },
  { id: "shopping", label: "Compras", icon: ShoppingBasket },
  { id: "library", label: "Exercícios", icon: BookOpen },
] as const;

function numeric(value: string, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : 0;
}

function percentage(value: number, target: number) {
  return `${progressPercent(value, target)}%`;
}

function dateLabel(value: string) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";
}

async function edgeError(error: unknown) {
  const candidate = error as { context?: { json?: () => Promise<unknown> } };
  try {
    if (candidate?.context?.json) {
      const payload = (await candidate.context.json()) as {
        error?: string;
        code?: string;
      };
      return payload.error || "Não foi possível gerar o cardápio.";
    }
  } catch {
    // Use the safe message below when the response is not JSON.
  }
  return "Não foi possível gerar o cardápio. Tente novamente em instantes.";
}

export function ProWorkspace({ onRefresh }: { onRefresh: () => void }) {
  const [activeTool, setActiveTool] = useState<Tool>("overview");
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [draft, setDraft] = useState<NutritionProfile>(
    DEFAULT_NUTRITION_PROFILE,
  );
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [access, setAccess] = useState<NutritionAccess | null>(null);
  const [selectedPlanDay, setSelectedPlanDay] = useState(0);
  const [day, setDay] = useState(localDateValue);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [food, setFood] = useState<FoodDraft>(emptyFood);
  const [waterAmount, setWaterAmount] = useState("250");
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("Todos");
  const [checkedShopping, setCheckedShopping] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const loadCore = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const [profileResult, planResult, accessResult] = await Promise.all([
        supabase
          .from("summer_nutrition_profiles")
          .select(
            "user_id,goal,age,height_cm,weight_kg,activity_level,dietary_preference,allergies,disliked_foods,meals_per_day,water_target_ml,updated_at",
          )
          .maybeSingle(),
        supabase
          .from("summer_meal_plans")
          .select(
            "id,profile_snapshot,targets,days,shopping_list,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("summer_get_nutrition_access"),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (planResult.error) throw planResult.error;
      if (accessResult.error) throw accessResult.error;
      const savedProfile = profileResult.data as NutritionProfile | null;
      setProfile(savedProfile);
      if (savedProfile) setDraft(savedProfile);
      setPlan(readMealPlan(planResult.data));
      setAccess(accessResult.data as NutritionAccess);
    } catch {
      setMessage(
        "Não foi possível carregar o painel PRO. Atualize a página e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDay = useCallback(async () => {
    try {
      const supabase = createClient();
      const [foodResult, waterResult] = await Promise.all([
        supabase
          .from("summer_calorie_entries")
          .select(
            "id,label,meal_type,calories,protein_g,carbs_g,fat_g",
          )
          .eq("day", day)
          .order("created_at"),
        supabase
          .from("summer_water_entries")
          .select("id,amount_ml,created_at")
          .eq("day", day)
          .order("created_at"),
      ]);
      if (foodResult.error) throw foodResult.error;
      if (waterResult.error) throw waterResult.error;
      setEntries((foodResult.data || []) as NutritionEntry[]);
      setWaterEntries((waterResult.data || []) as WaterEntry[]);
    } catch {
      setEntries([]);
      setWaterEntries([]);
      setMessage("Não foi possível carregar os registros deste dia.");
    }
  }, [day]);

  const loadLibrary = useCallback(async () => {
    if (exercises.length || libraryLoading) return;
    setLibraryLoading(true);
    try {
      const { data, error } = await createClient()
        .from("summer_exercise_library")
        .select(
          "id,slug,name,muscle_group,equipment,difficulty,instructions,tips",
        )
        .order("muscle_group")
        .order("name");
      if (error) throw error;
      setExercises((data || []) as ExerciseLibraryItem[]);
    } catch {
      setMessage("Não foi possível carregar a biblioteca de exercícios.");
    } finally {
      setLibraryLoading(false);
    }
  }, [exercises.length, libraryLoading]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);
  useEffect(() => {
    void loadDay();
  }, [loadDay]);
  useEffect(() => {
    if (activeTool === "library") void loadLibrary();
  }, [activeTool, loadLibrary]);

  const targets = useMemo(
    () => plan?.targets || calculateNutritionTargets(profile || draft),
    [draft, plan, profile],
  );
  const totals = useMemo(() => nutritionTotals(entries), [entries]);
  const waterTotal = waterEntries.reduce(
    (total, item) => total + Number(item.amount_ml || 0),
    0,
  );
  const groups = useMemo(
    () => [
      "Todos",
      ...Array.from(new Set(exercises.map((item) => item.muscle_group))),
    ],
    [exercises],
  );
  const visibleExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLocaleLowerCase("pt-BR");
    return exercises.filter(
      (item) =>
        (muscleGroup === "Todos" || item.muscle_group === muscleGroup) &&
        (!query ||
          `${item.name} ${item.muscle_group} ${item.equipment}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)),
    );
  }, [exerciseSearch, exercises, muscleGroup]);

  function validProfile(value: NutritionProfile) {
    return (
      value.age >= 18 &&
      value.age <= 90 &&
      value.height_cm >= 120 &&
      value.height_cm <= 230 &&
      value.weight_kg >= 35 &&
      value.weight_kg <= 300 &&
      value.meals_per_day >= 3 &&
      value.meals_per_day <= 6 &&
      value.water_target_ml >= 1000 &&
      value.water_target_ml <= 6000
    );
  }

  async function saveProfile(generate: boolean) {
    if (busy || !validProfile(draft)) {
      setMessage("Revise os dados do perfil nutricional.");
      return;
    }
    setBusy(generate ? "generate" : "profile");
    setMessage("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError;
      const normalized: NutritionProfile = {
        ...draft,
        user_id: auth.user.id,
        age: Math.round(draft.age),
        height_cm: Math.round(draft.height_cm * 10) / 10,
        weight_kg: Math.round(draft.weight_kg * 10) / 10,
        meals_per_day: Math.round(draft.meals_per_day),
        water_target_ml: Math.round(draft.water_target_ml),
        allergies: draft.allergies.trim(),
        disliked_foods: draft.disliked_foods.trim(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("summer_nutrition_profiles")
        .upsert(normalized, { onConflict: "user_id" });
      if (error) throw error;
      setProfile(normalized);
      setDraft(normalized);
      if (!generate) {
        setMessage("Perfil nutricional salvo.");
        return;
      }
      const { data, error: functionError } = await supabase.functions.invoke(
        "generate-nutrition-plan",
        { body: { action: "generate" } },
      );
      if (functionError || !data?.plan) {
        setMessage(await edgeError(functionError));
        return;
      }
      const generated = readMealPlan(data.plan);
      if (!generated) throw new Error("invalid_plan");
      setPlan(generated);
      setAccess((current) =>
        current
          ? {
              ...current,
              used: current.used + 1,
              remaining: Math.max(0, current.remaining - 1),
            }
          : current,
      );
      setSelectedPlanDay(0);
      setActiveTool("menu");
      setMessage("Seu cardápio personalizado de 7 dias está pronto.");
    } catch {
      setMessage(
        "Não foi possível salvar ou gerar o cardápio. Confira sua conexão e tente novamente.",
      );
      onRefresh();
    } finally {
      setBusy("");
    }
  }

  async function addFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !food.label.trim()) return;
    setBusy("food");
    setMessage("");
    try {
      const { error } = await createClient()
        .from("summer_calorie_entries")
        .insert({
          day,
          label: food.label.trim(),
          meal_type: food.meal_type,
          calories: numeric(food.calories, 1, 10000),
          protein_g: numeric(food.protein_g, 0, 1000),
          carbs_g: numeric(food.carbs_g, 0, 1500),
          fat_g: numeric(food.fat_g, 0, 1000),
        });
      if (error) throw error;
      setFood(emptyFood);
      await loadDay();
      setMessage("Refeição registrada.");
    } catch {
      setMessage("Não foi possível registrar esta refeição.");
      onRefresh();
    } finally {
      setBusy("");
    }
  }

  async function removeFood(id: string) {
    if (busy || !window.confirm("Excluir este registro alimentar?")) return;
    setBusy(`food-${id}`);
    try {
      const { data, error } = await createClient()
        .from("summer_calorie_entries")
        .delete()
        .eq("id", id)
        .select("id");
      if (error || !data?.length) throw error;
      await loadDay();
    } catch {
      setMessage("Não foi possível excluir o registro.");
    } finally {
      setBusy("");
    }
  }

  async function addWater(amount: number) {
    if (busy || amount < 50 || amount > 5000) return;
    setBusy("water");
    setMessage("");
    try {
      const { error } = await createClient()
        .from("summer_water_entries")
        .insert({ day, amount_ml: amount });
      if (error) throw error;
      await loadDay();
      setMessage(`${amount} ml de água registrados.`);
    } catch {
      setMessage("Não foi possível registrar a água.");
      onRefresh();
    } finally {
      setBusy("");
    }
  }

  async function removeWater(id: number) {
    if (busy) return;
    setBusy(`water-${id}`);
    try {
      const { data, error } = await createClient()
        .from("summer_water_entries")
        .delete()
        .eq("id", id)
        .select("id");
      if (error || !data?.length) throw error;
      await loadDay();
    } catch {
      setMessage("Não foi possível remover este registro de água.");
    } finally {
      setBusy("");
    }
  }

  const selectedDay = plan?.days[selectedPlanDay];

  return (
    <section className="pro-workspace" aria-label="Ferramentas Summer PRO">
      <div className="pro-workspace-heading">
        <div>
          <p className="eyebrow">SUAS FERRAMENTAS PRO</p>
          <h3>Nutrição, evolução e execução em um só lugar</h3>
          <p>
            Agora estes recursos são funcionais e ficam sincronizados com sua
            conta.
          </p>
        </div>
        {access && (
          <span className="ai-usage-badge">
            <Sparkles size={15} /> {access.remaining} de {access.monthly_limit}{" "}
            cardápios disponíveis
          </span>
        )}
      </div>

      <nav className="pro-tool-tabs" aria-label="Recursos do Summer PRO">
        {tools.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeTool === id ? "active" : ""}
            onClick={() => setActiveTool(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <div role="status" aria-live="polite">
        {message && <p className="notice">{message}</p>}
      </div>

      {loading ? (
        <div className="pro-loading" role="status">
          <LoaderCircle className="spin" size={24} />
          Carregando seu espaço PRO...
        </div>
      ) : (
        <>
          {activeTool === "overview" && (
            <div className="pro-overview">
              <div className="pro-metric-grid">
                <article>
                  <Apple size={20} />
                  <span>Meta calórica</span>
                  <strong>
                    {targets.calories_min}–{targets.calories_max}
                    <small> kcal/dia</small>
                  </strong>
                </article>
                <article>
                  <Dumbbell size={20} />
                  <span>Proteína</span>
                  <strong>
                    {targets.protein_g}<small> g/dia</small>
                  </strong>
                </article>
                <article>
                  <Droplets size={20} />
                  <span>Água</span>
                  <strong>
                    {(targets.water_ml / 1000).toLocaleString("pt-BR")}
                    <small> L/dia</small>
                  </strong>
                </article>
                <article>
                  <CalendarDays size={20} />
                  <span>Cardápio atual</span>
                  <strong>
                    {plan ? "7 dias" : "Pendente"}
                    <small>{plan ? ` · ${dateLabel(plan.created_at)}` : ""}</small>
                  </strong>
                </article>
              </div>

              <section className="pro-action-card featured">
                <div className="pro-action-icon">
                  <Sparkles size={25} />
                </div>
                <div>
                  <p className="eyebrow">NUTRIÇÃO COM IA</p>
                  <h4>
                    {plan
                      ? "Seu cardápio está pronto"
                      : "Crie seu primeiro cardápio personalizado"}
                  </h4>
                  <p>
                    Responda ao perfil abaixo e receba sete dias de refeições,
                    metas e lista de compras.
                  </p>
                </div>
                {plan && (
                  <button
                    className="primary-button"
                    onClick={() => setActiveTool("menu")}
                  >
                    VER CARDÁPIO
                  </button>
                )}
              </section>

              <form
                className="nutrition-profile-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveProfile(true);
                }}
              >
                <div className="section-heading">
                  <div>
                    <h4>Seu perfil nutricional</h4>
                    <p>Essas informações personalizam as metas e refeições.</p>
                  </div>
                  {profile && <span>Perfil salvo</span>}
                </div>
                <div className="nutrition-form-grid">
                  <label>
                    Objetivo
                    <select
                      value={draft.goal}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          goal: event.target.value as NutritionGoal,
                        })
                      }
                    >
                      {Object.entries(GOAL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Idade
                    <input
                      type="number"
                      min={18}
                      max={90}
                      required
                      value={draft.age}
                      onChange={(event) =>
                        setDraft({ ...draft, age: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Altura (cm)
                    <input
                      type="number"
                      min={120}
                      max={230}
                      step="0.1"
                      required
                      value={draft.height_cm}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          height_cm: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Peso (kg)
                    <input
                      type="number"
                      min={35}
                      max={300}
                      step="0.1"
                      required
                      value={draft.weight_kg}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          weight_kg: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Nível de atividade
                    <select
                      value={draft.activity_level}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          activity_level: event.target.value as ActivityLevel,
                        })
                      }
                    >
                      {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Alimentação
                    <select
                      value={draft.dietary_preference}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          dietary_preference: event.target
                            .value as DietaryPreference,
                        })
                      }
                    >
                      {Object.entries(DIET_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Refeições por dia
                    <input
                      type="number"
                      min={3}
                      max={6}
                      required
                      value={draft.meals_per_day}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          meals_per_day: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Meta de água (ml)
                    <input
                      type="number"
                      min={1000}
                      max={6000}
                      step={100}
                      required
                      value={draft.water_target_ml}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          water_target_ml: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="wide-field">
                    Alergias ou restrições
                    <input
                      maxLength={500}
                      placeholder="Ex.: amendoim, frutos do mar"
                      value={draft.allergies}
                      onChange={(event) =>
                        setDraft({ ...draft, allergies: event.target.value })
                      }
                    />
                  </label>
                  <label className="wide-field">
                    Alimentos que não gosta
                    <input
                      maxLength={500}
                      placeholder="Ex.: abacate, aveia"
                      value={draft.disliked_foods}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          disliked_foods: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="nutrition-form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() => void saveProfile(false)}
                  >
                    SALVAR PERFIL
                  </button>
                  <button
                    className="primary-button"
                    disabled={Boolean(busy) || access?.allowed === false}
                  >
                    {busy === "generate" ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Sparkles size={17} />
                    )}
                    {plan ? "GERAR NOVO CARDÁPIO" : "GERAR CARDÁPIO DE 7 DIAS"}
                  </button>
                </div>
                <small className="nutrition-disclaimer">
                  Sugestões gerais para adultos. Não substituem nutricionista ou
                  orientação médica. Confira sempre ingredientes e alergias.
                </small>
              </form>
            </div>
          )}

          {activeTool === "menu" && (
            <div className="meal-plan-panel">
              {!plan ? (
                <div className="empty-state compact-empty">
                  <ChefHat size={30} />
                  <h3>Seu cardápio ainda não foi criado</h3>
                  <p>Complete o perfil para a IA montar os sete dias.</p>
                  <button
                    className="primary-button"
                    onClick={() => setActiveTool("overview")}
                  >
                    COMEÇAR AGORA
                  </button>
                </div>
              ) : (
                <>
                  <div className="meal-plan-header">
                    <div>
                      <p className="eyebrow">CARDÁPIO PERSONALIZADO</p>
                      <h4>7 dias para o seu objetivo</h4>
                      <p>
                        Gerado em {dateLabel(plan.created_at)} ·{" "}
                        {GOAL_LABELS[plan.profile_snapshot.goal]}
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      disabled={Boolean(busy) || access?.allowed === false}
                      onClick={() => void saveProfile(true)}
                    >
                      <RefreshCw size={16} />
                      GERAR NOVO
                    </button>
                  </div>
                  <div className="plan-day-tabs" aria-label="Dias do cardápio">
                    {plan.days.map((item, index) => (
                      <button
                        key={item.day}
                        className={selectedPlanDay === index ? "active" : ""}
                        onClick={() => setSelectedPlanDay(index)}
                        type="button"
                      >
                        {item.day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                  {selectedDay && (
                    <>
                      <div className="day-target-summary">
                        <span>
                          <strong>{selectedDay.totals.calories}</strong> kcal
                        </span>
                        <span>
                          <strong>{selectedDay.totals.protein_g}</strong> g proteína
                        </span>
                        <span>
                          <strong>{selectedDay.totals.carbs_g}</strong> g carbo
                        </span>
                        <span>
                          <strong>{selectedDay.totals.fat_g}</strong> g gordura
                        </span>
                      </div>
                      <div className="meal-grid">
                        {selectedDay.meals.map((meal) => (
                          <article className="meal-card" key={meal.id}>
                            <div className="meal-card-top">
                              <span>{MEAL_LABELS[meal.mealType]}</span>
                              <small>{meal.prep_minutes} min</small>
                            </div>
                            <h5>{meal.name}</h5>
                            <p>{meal.description}</p>
                            <strong className="meal-portion">{meal.portion}</strong>
                            <div className="meal-macros">
                              <span>{meal.calories} kcal</span>
                              <span>{meal.protein_g} g P</span>
                              <span>{meal.carbs_g} g C</span>
                              <span>{meal.fat_g} g G</span>
                            </div>
                            <details>
                              <summary>Ver ingredientes</summary>
                              <ul>
                                {meal.ingredients.map((ingredient) => (
                                  <li key={ingredient}>{ingredient}</li>
                                ))}
                              </ul>
                            </details>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeTool === "diary" && (
            <div className="nutrition-diary">
              <div className="diary-heading">
                <div>
                  <p className="eyebrow">ACOMPANHAMENTO DIÁRIO</p>
                  <h4>Calorias, macros e água</h4>
                </div>
                <label>
                  Dia
                  <input
                    type="date"
                    value={day}
                    onChange={(event) => event.target.value && setDay(event.target.value)}
                  />
                </label>
              </div>
              <div className="macro-progress-grid">
                {[
                  {
                    label: "Calorias",
                    value: totals.calories,
                    target: targets.calories_max,
                    unit: "kcal",
                  },
                  {
                    label: "Proteína",
                    value: totals.protein_g,
                    target: targets.protein_g,
                    unit: "g",
                  },
                  {
                    label: "Carboidratos",
                    value: totals.carbs_g,
                    target: targets.carbs_g,
                    unit: "g",
                  },
                  {
                    label: "Gorduras",
                    value: totals.fat_g,
                    target: targets.fat_g,
                    unit: "g",
                  },
                ].map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>
                      {item.value} <small>/ {item.target} {item.unit}</small>
                    </strong>
                    <div className="macro-track">
                      <i style={{ width: percentage(item.value, item.target) }} />
                    </div>
                  </article>
                ))}
              </div>

              <section className="water-card">
                <div className="water-ring">
                  <Droplets size={24} />
                  <strong>{waterTotal} ml</strong>
                  <span>de {targets.water_ml} ml</span>
                </div>
                <div className="water-controls">
                  <h5>Registrar água</h5>
                  <p>
                    {Math.max(0, targets.water_ml - waterTotal)} ml restantes para
                    sua meta.
                  </p>
                  <div>
                    <button
                      className="secondary-button"
                      disabled={Boolean(busy)}
                      onClick={() => void addWater(250)}
                    >
                      + 250 ml
                    </button>
                    <button
                      className="secondary-button"
                      disabled={Boolean(busy)}
                      onClick={() => void addWater(500)}
                    >
                      + 500 ml
                    </button>
                  </div>
                  <div className="custom-water">
                    <input
                      aria-label="Quantidade personalizada de água"
                      type="number"
                      min={50}
                      max={5000}
                      step={50}
                      value={waterAmount}
                      onChange={(event) => setWaterAmount(event.target.value)}
                    />
                    <button
                      className="primary-button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void addWater(numeric(waterAmount, 50, 5000))
                      }
                    >
                      ADICIONAR
                    </button>
                  </div>
                </div>
              </section>
              {waterEntries.length > 0 && (
                <div className="water-history">
                  {waterEntries.map((item) => (
                    <span key={item.id}>
                      {item.amount_ml} ml
                      <button
                        aria-label={`Remover ${item.amount_ml} ml`}
                        onClick={() => void removeWater(item.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <form className="food-log-form" onSubmit={addFood}>
                <div className="section-heading">
                  <div>
                    <h4>Registrar refeição</h4>
                    <p>Adicione calorias e macros consumidos.</p>
                  </div>
                </div>
                <div className="food-log-grid">
                  <label className="wide-field">
                    Alimento ou refeição
                    <input
                      required
                      maxLength={100}
                      placeholder="Ex.: Almoço"
                      value={food.label}
                      onChange={(event) =>
                        setFood({ ...food, label: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={food.meal_type}
                      onChange={(event) =>
                        setFood({
                          ...food,
                          meal_type: event.target.value as MealType,
                        })
                      }
                    >
                      {Object.entries(MEAL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Calorias
                    <input
                      required
                      type="number"
                      min={1}
                      max={10000}
                      value={food.calories}
                      onChange={(event) =>
                        setFood({ ...food, calories: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Proteína (g)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step="0.1"
                      value={food.protein_g}
                      onChange={(event) =>
                        setFood({ ...food, protein_g: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Carboidratos (g)
                    <input
                      type="number"
                      min={0}
                      max={1500}
                      step="0.1"
                      value={food.carbs_g}
                      onChange={(event) =>
                        setFood({ ...food, carbs_g: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Gorduras (g)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step="0.1"
                      value={food.fat_g}
                      onChange={(event) =>
                        setFood({ ...food, fat_g: event.target.value })
                      }
                    />
                  </label>
                  <button className="primary-button" disabled={Boolean(busy)}>
                    <Plus size={16} /> REGISTRAR
                  </button>
                </div>
              </form>

              <div className="food-log-list">
                {entries.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <span>{MEAL_LABELS[entry.meal_type] || "Refeição"}</span>
                      <strong>{entry.label}</strong>
                    </div>
                    <p>
                      {entry.calories} kcal · {entry.protein_g}g P ·{" "}
                      {entry.carbs_g}g C · {entry.fat_g}g G
                    </p>
                    <button
                      className="icon-button"
                      disabled={Boolean(busy)}
                      aria-label={`Excluir ${entry.label}`}
                      onClick={() => void removeFood(entry.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
                {!entries.length && <p>Nenhuma refeição registrada neste dia.</p>}
              </div>
            </div>
          )}

          {activeTool === "shopping" && (
            <div className="shopping-panel">
              {!plan ? (
                <div className="empty-state compact-empty">
                  <ShoppingBasket size={30} />
                  <h3>Gere um cardápio primeiro</h3>
                  <p>A lista de compras será montada automaticamente.</p>
                  <button
                    className="primary-button"
                    onClick={() => setActiveTool("overview")}
                  >
                    CRIAR CARDÁPIO
                  </button>
                </div>
              ) : (
                <>
                  <div className="meal-plan-header">
                    <div>
                      <p className="eyebrow">LISTA AUTOMÁTICA</p>
                      <h4>Compras para os 7 dias</h4>
                      <p>{plan.shopping_list.length} itens organizados por categoria.</p>
                    </div>
                    <span className="shopping-count">
                      <ListChecks size={17} /> {checkedShopping.length} concluídos
                    </span>
                  </div>
                  <div className="shopping-groups">
                    {Array.from(
                      new Set(plan.shopping_list.map((item) => item.category)),
                    ).map((category) => (
                      <section key={category}>
                        <h5>{category}</h5>
                        {plan.shopping_list
                          .filter((item) => item.category === category)
                          .map((item, index) => {
                            const id = `${category}-${item.name}-${index}`;
                            return (
                              <label key={id}>
                                <input
                                  type="checkbox"
                                  checked={checkedShopping.includes(id)}
                                  onChange={(event) =>
                                    setCheckedShopping((current) =>
                                      event.target.checked
                                        ? [...current, id]
                                        : current.filter((value) => value !== id),
                                    )
                                  }
                                />
                                <span>{item.name}</span>
                                <small>{item.quantity}</small>
                              </label>
                            );
                          })}
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTool === "library" && (
            <div className="exercise-library-panel">
              <div className="meal-plan-header">
                <div>
                  <p className="eyebrow">BIBLIOTECA DE EXECUÇÃO</p>
                  <h4>Aprenda os principais exercícios</h4>
                  <p>Passos e cuidados práticos para sua rotina.</p>
                </div>
              </div>
              <div className="library-filters">
                <label>
                  <Search size={17} />
                  <input
                    type="search"
                    placeholder="Buscar exercício"
                    value={exerciseSearch}
                    onChange={(event) => setExerciseSearch(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrar por grupo muscular"
                  value={muscleGroup}
                  onChange={(event) => setMuscleGroup(event.target.value)}
                >
                  {groups.map((group) => (
                    <option key={group}>{group}</option>
                  ))}
                </select>
              </div>
              {libraryLoading ? (
                <div className="pro-loading">
                  <LoaderCircle className="spin" size={22} /> Carregando biblioteca...
                </div>
              ) : (
                <div className="exercise-library-grid">
                  {visibleExercises.map((exercise) => (
                    <details key={exercise.id} className="library-exercise-card">
                      <summary>
                        <span className="library-exercise-icon">
                          <Dumbbell size={19} />
                        </span>
                        <span>
                          <strong>{exercise.name}</strong>
                          <small>
                            {exercise.muscle_group} · {exercise.equipment}
                          </small>
                        </span>
                        <em>{exercise.difficulty}</em>
                      </summary>
                      <div>
                        <h6>Como executar</h6>
                        <ol>
                          {exercise.instructions.map((instruction) => (
                            <li key={instruction}>{instruction}</li>
                          ))}
                        </ol>
                        {exercise.tips.length > 0 && (
                          <>
                            <h6>Cuidados</h6>
                            <ul>
                              {exercise.tips.map((tip) => (
                                <li key={tip}>{tip}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
              {!libraryLoading && !visibleExercises.length && (
                <p>Nenhum exercício encontrado com esse filtro.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
