"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import { PanelLoading } from "@/components/panel-loading";
import { NutritionistCard } from "@/components/nutritionist-card";
import { RestTimer, WorkoutClock } from "@/components/workout-clock";
import { TAB_PATHS, tabFromHash, type AppTab } from "@/lib/navigation";
const PlanPanel = dynamic(() => import("@/components/plan-panel").then((module) => module.PlanPanel), { loading: PanelLoading });
const ProWorkspace = dynamic(() => import("@/components/pro-workspace").then((module) => module.ProWorkspace), { loading: PanelLoading });
const ProPaywall = dynamic(() => import("@/components/pro-paywall").then((module) => module.ProPaywall));
const ProProgressInsights = dynamic(() => import("@/components/pro-progress-insights").then((module) => module.ProProgressInsights), { loading: PanelLoading });
const WorkoutImporter = dynamic(() => import("@/components/workout-importer").then((module) => module.WorkoutImporter), { loading: PanelLoading });
import {
  effectiveExpiresAt,
  effectiveStatus,
  isProAccess,
  subscriptionPlanLabel,
  type Access,
} from "@/lib/plans";
import { AuthScreen } from "@/components/auth-screen";
import { createClient } from "@/lib/supabase/client";
import { createSubscriptionSync } from "@/lib/subscription-sync";
import type { Membership } from "@/lib/membership";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import {
  emptyFitness,
  readFitness,
  weekSummary,
  MAX_WORKOUTS,
  MAX_SESSIONS,
  type FitnessData,
  type Workout,
} from "@/lib/fitness";
import {
  ArrowRight,
  Camera,
  Crown,
  ShieldCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Dumbbell,
  Home,
  LockKeyhole,
  LogOut,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Utensils,
  UserRound,
  X,
} from "lucide-react";

const navItems = [
  { label: "Início", icon: Home },
  { label: "Treinos", icon: Dumbbell },
  { label: "Nutrição", icon: Utensils },
  { label: "Progresso", icon: TrendingUp },
  { label: "Perfil", icon: UserRound },
] as const;
const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
function newWorkout(): Workout {
  return {
    id: crypto.randomUUID(),
    title: "",
    focus: "",
    minutes: 45,
    exercises: [{ id: crypto.randomUUID(), name: "", sets: 3, reps: "10–12" }],
  };
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let mounted = true;
    if (!hasSupabaseConfig()) {
      setAuthError(
        "O acesso está temporariamente indisponível. A configuração do serviço precisa ser concluída.",
      );
      setAuthLoading(false);
      return;
    }
    const supabase = createClient();
    const timer = window.setTimeout(() => {
      if (mounted) {
        setAuthError(
          "A conexão demorou mais que o esperado. Confira sua internet e tente novamente.",
        );
        setAuthLoading(false);
      }
    }, 15000);
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!mounted) return;
        window.clearTimeout(timer);
        setUser(data.user);
        setAuthLoading(false);
        if (error && error.name !== "AuthSessionMissingError")
          setAuthError(
            "Não foi possível verificar seu acesso. Tente entrar novamente.",
          );
      })
      .catch(() => {
        if (mounted) {
          window.clearTimeout(timer);
          setAuthError("Não foi possível conectar. Tente novamente.");
          setAuthLoading(false);
        }
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY") {
          window.location.replace("/auth/reset-password");
          return;
        }
        setUser(session?.user ?? null);
        if (session) {
          window.clearTimeout(timer);
          setAuthError("");
          setAuthLoading(false);
        }
      },
    );
    if (new URLSearchParams(window.location.search).has("auth_error"))
      setAuthError(
        "O link de confirmação expirou ou não pôde ser validado. Tente entrar ou solicite outro link.",
      );
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);
  if (authLoading)
    return (
      <main className="auth-shell">
        <div className="auth-loading" role="status">
          <Dumbbell size={28} />
          <p>Abrindo seu espaço Summer Fit...</p>
        </div>
      </main>
    );
  if (!user) return <AuthScreen initialMessage={authError} />;
  return <MembershipBoundary key={user.id} user={user} />;
}

function MembershipBoundary({ user }: { user: User }) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let running = false;
    let lastState = "";
    const refresh = async () => {
      if (disposed || running || document.hidden || !navigator.onLine) return;
      running = true;
      try {
        const { data, error: membershipError } = await createClient().rpc("summer_get_membership");
        if (membershipError || !data) throw membershipError || new Error("membership unavailable");
        if (disposed) return;
        const next = data as Membership;
        const state = JSON.stringify([next.status, next.registration, next.is_admin, next.updated_at]);
        if (state !== lastState) {
          lastState = state;
          setMembership(next);
        }
        setError("");
      } catch {
        if (!disposed && !membership) setError("Não foi possível verificar sua matrícula. Confira a conexão e tente novamente.");
      } finally {
        if (!disposed) setLoading(false);
        running = false;
      }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const visibleRefresh = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", visibleRefresh);
    window.addEventListener("online", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    const timer = window.setInterval(visibleRefresh, 5000);
    return () => {
      disposed = true;
      refreshRef.current = () => {};
      window.removeEventListener("focus", visibleRefresh);
      window.removeEventListener("online", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
      window.clearInterval(timer);
    };
  }, [user.id]);

  async function signOut() {
    await createClient().auth.signOut();
  }
  if (loading && !membership) return <main className="auth-shell"><PanelLoading /></main>;
  if (membership?.is_admin || membership?.status === "active")
    return <Dashboard key={user.id} user={user} />;

  const status = membership?.status;
  const content = status === "suspended"
    ? { title: "Acesso suspenso", text: "Seu acesso foi suspenso pela administração. Seus treinos continuam salvos e voltarão quando sua matrícula for reativada." }
    : status === "inactive"
      ? { title: "Matrícula inativa", text: "Sua matrícula não está ativa no momento. Seus dados permanecem guardados caso você volte para a academia." }
      : { title: "Finalizando seu acesso", text: "Seu cadastro está sendo preparado. Toque em verificar novamente; não é necessária aprovação manual." };
  return <main className="auth-shell membership-shell">
    <section className="auth-card membership-gate" aria-live="polite">
      <img className="membership-logo" src="/summer-fit-brand.jpeg" alt="Summer Fit" />
      <div className="membership-gate-icon"><ShieldCheck size={28} /></div>
      <p className="eyebrow">ACESSO EXCLUSIVO PARA ALUNOS</p>
      <h1>{error ? "Não foi possível verificar seu acesso" : content.title}</h1>
      <p>{error || content.text}</p>
      {membership?.registration && <div className="membership-number"><span>Matrícula informada</span><strong>{membership.registration}</strong></div>}
      <p className="membership-auto-note">Esta tela será atualizada automaticamente assim que o cadastro estiver pronto.</p>
      <div className="membership-gate-actions">
        <button className="primary-button" onClick={() => refreshRef.current()}><RefreshCw size={17} />VERIFICAR AGORA</button>
        <button className="secondary-button" onClick={() => void signOut()}><LogOut size={17} />Sair da conta</button>
      </div>
    </section>
  </main>;
}

function Dashboard({ user }: { user: User }) {
  const [activeTab, updateActiveTab] = useState<AppTab>("Início");
  const [nutritionVisited, setNutritionVisited] = useState(false);
  const [online, setOnline] = useState(true);
  const setActiveTab = useCallback((tab: AppTab) => {
    updateActiveTab(tab);
    if (window.location.hash !== `#${TAB_PATHS[tab]}`) window.history.pushState(null, "", `#${TAB_PATHS[tab]}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    const syncTab = () => updateActiveTab(tabFromHash(window.location.hash));
    const syncOnline = () => setOnline(navigator.onLine);
    syncTab(); syncOnline();
    window.addEventListener("popstate", syncTab);
    window.addEventListener("hashchange", syncTab);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("popstate", syncTab);
      window.removeEventListener("hashchange", syncTab);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);
  useEffect(() => { if (activeTab === "Nutrição") setNutritionVisited(true); }, [activeTab]);
  const [fitness, setFitness] = useState<FitnessData>(emptyFitness);
  const [draft, setDraft] = useState<Workout | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [active, setActive] = useState<{
    workout: Workout;
    startedAt: number;
  } | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [notice, setNotice] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [name, setName] = useState(String(user.user_metadata?.name || ""));
  const [goal, setGoal] = useState(fitness.goal);
  const [search, setSearch] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [access, setAccess] = useState<Access | null>(null);
  const paid = isProAccess(access);
  const subscriptionSync = useRef<ReturnType<typeof createSubscriptionSync> | null>(null);
  const refreshAccess = useCallback(async () => {
    await subscriptionSync.current?.refresh();
  }, []);
  useEffect(() => {
    const sync = createSubscriptionSync(async (signal) => {
      const { data, error } = await createClient()
        .rpc("summer_get_access")
        .abortSignal(signal);
      if (error || !data) throw error || new Error("access unavailable");
      return data as Access;
    }, (next, previous) => {
      setAccess(next);
      if (isProAccess(next)) setShowPaywall(false);
      if (previous && !isProAccess(previous) && isProAccess(next)) {
        setNotice("Seu Summer PRO foi liberado! Os recursos já estão disponíveis.");
      }
    });
    subscriptionSync.current = sync;
    const refresh = () => {
      if (!document.hidden && navigator.onLine) void sync.refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => {
      sync.dispose();
      subscriptionSync.current = null;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [user.id]);
  const summary = useMemo(() => weekSummary(fitness.sessions), [fitness.sessions]);
  const displayName = String(
    user.user_metadata?.name || user.email?.split("@")[0] || "Atleta",
  );
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const first = fitness.workouts[0];
  const progress = Math.min(
    100,
    Math.round((summary.count / fitness.goal) * 100),
  );
  const filtered = fitness.workouts.filter((w) =>
    `${w.title} ${w.focus}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const loadFitness = useCallback(async () => {
    setDataLoading(true);
    try {
      const { data, error } = await createClient()
        .from("summer_fitness_state")
        .select("data,revision")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      const current = readFitness(data?.data);
      setFitness(current);
      setGoal(current.goal);
      setDataReady(true);
    } catch {
      setNotice(
        "Não foi possível carregar suas fichas. Tente atualizar em instantes.",
      );
      setDataReady(false);
    } finally {
      setDataLoading(false);
    }
  }, [user.id]);
  useEffect(() => {
    void loadFitness();
  }, [loadFitness]);
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [active]);
  async function persist(
    change: (current: FitnessData) => FitnessData,
    success: string,
    extra: Record<string, unknown> = {},
  ) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      const supabase = createClient();
      const { data: current, error: readError } = await supabase.auth.getUser();
      if (readError || !current.user || current.user.id !== user.id)
        throw new Error("session");
      const { data: saved, error: stateError } = await supabase
        .from("summer_fitness_state")
        .select("data,revision")
        .eq("user_id", user.id)
        .maybeSingle();
      if (stateError) throw stateError;
      const next = change(readFitness(saved?.data));
      const { error } = await supabase.rpc("summer_save_fitness", {
        p_data: next,
        p_revision: saved?.revision || 0,
      });
      if (error) throw error;
      if (Object.keys(extra).length) {
        const { error: profileError } = await supabase.auth.updateUser({
          data: extra,
        });
        if (profileError) {
          setFitness(next);
          setNotice(
            "Meta salva. Não foi possível atualizar seu nome; tente novamente.",
          );
          return false;
        }
      }
      setFitness(next);
      setNotice(success);
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error && error.message === "limit"
          ? `Você já tem ${MAX_WORKOUTS} fichas. Exclua uma para criar outra.`
          : "Não foi possível salvar na sua conta. Confira a conexão e tente novamente.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function openAddWorkout() {
    if (!dataReady) {
      setNotice("Aguarde o carregamento das fichas e tente atualizar.");
      return;
    }
    if (fitness.workouts.length >= MAX_WORKOUTS) {
      setNotice(
        `Você pode manter até ${MAX_WORKOUTS} fichas. Exclua uma antes de criar outra.`,
      );
      return;
    }
    setShowImporter(true);
    setActiveTab("Treinos");
  }
  function createManualWorkout() {
    if (!dataReady) {
      setNotice("Aguarde o carregamento das fichas e tente atualizar.");
      return;
    }
    if (fitness.workouts.length >= MAX_WORKOUTS) {
      setNotice(
        `Você pode manter até ${MAX_WORKOUTS} fichas. Exclua uma antes de criar outra.`,
      );
      return;
    }
    setShowImporter(false);
    setDraft(newWorkout());
    setActiveTab("Treinos");
  }
  async function saveWorkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const workout = {
      ...draft,
      title: draft.title.trim(),
      focus: draft.focus.trim(),
      exercises: draft.exercises.map((e) => ({
        ...e,
        name: e.name.trim(),
        reps: e.reps.trim(),
        ...(typeof e.weight === "number" &&
        Number.isFinite(e.weight) &&
        e.weight >= 0
          ? { weight: e.weight, weightUnit: e.weightUnit || ("kg" as const) }
          : { weight: undefined, weightUnit: undefined }),
        ...(typeof e.restSeconds === "number" &&
        Number.isFinite(e.restSeconds) &&
        e.restSeconds >= 0
          ? { restSeconds: e.restSeconds }
          : { restSeconds: undefined }),
        ...(e.notes?.trim() ? { notes: e.notes.trim() } : { notes: undefined }),
      })),
    };
    if (
      !workout.title ||
      !workout.exercises.length ||
      workout.exercises.some((e) => !e.name || !e.reps)
    ) {
      setNotice("Preencha o nome do treino e de todos os exercícios.");
      return;
    }
    if (
      await persist((current) => {
        const exists = current.workouts.some((w) => w.id === workout.id);
        if (!exists && current.workouts.length >= MAX_WORKOUTS)
          throw new Error("limit");
        return {
          ...current,
          workouts: exists
            ? current.workouts.map((w) => (w.id === workout.id ? workout : w))
            : [...current.workouts, workout],
        };
      }, "Ficha salva na sua conta.")
    )
      setDraft(null);
  }
  async function removeWorkout(workout: Workout) {
    if (
      !window.confirm(
        `Excluir a ficha “${workout.title}”? Seu histórico de treinos será mantido.`,
      )
    )
      return;
    await persist(
      (current) => ({
        ...current,
        workouts: current.workouts.filter((w) => w.id !== workout.id),
      }),
      "Ficha excluída. Histórico mantido.",
    );
  }
  async function saveImportedWorkouts(workouts: Workout[], importId: string) {
    const saved = await persist((current) => {
      if (current.workouts.length + workouts.length > MAX_WORKOUTS)
        throw new Error("limit");
      return { ...current, workouts: [...current.workouts, ...workouts] };
    }, "Treinos importados e salvos na sua conta.");
    if (!saved) return false;
    try {
      const { error } = await createClient().rpc(
        "summer_complete_workout_import",
        { p_import_id: importId },
      );
      if (error) throw error;
    } catch {
      setNotice(
        "Seus treinos foram salvos. O histórico da digitalização será atualizado automaticamente depois.",
      );
    }
    return true;
  }
  function startWorkout(workout: Workout) {
    if (active) {
      setNotice(
        "Você já tem um treino em andamento. Conclua ou encerre antes de começar outro.",
      );
      return;
    }
    setActive({ workout, startedAt: Date.now() });
    setChecked([]);
    setNotice("Treino iniciado. Marque os exercícios conforme terminar.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function finishWorkout() {
    if (!active || checked.length !== active.workout.exercises.length) return;
    const session = {
      id: crypto.randomUUID(),
      workoutId: active.workout.id,
      title: active.workout.title,
      completedAt: new Date().toISOString(),
      minutes: Math.max(
        1,
        Math.min(240, Math.round((Date.now() - active.startedAt) / 60000)),
      ),
      exercises: active.workout.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        ...(typeof exercise.weight === "number"
          ? {
              weight: exercise.weight,
              weightUnit: exercise.weightUnit || ("kg" as const),
            }
          : {}),
      })),
    };
    if (
      await persist(
        (current) => ({
          ...current,
          sessions: [...current.sessions, session].slice(-MAX_SESSIONS),
        }),
        "Treino concluído! Mais um passo na sua evolução.",
      )
    ) {
      setActive(null);
      setActiveTab("Progresso");
    }
  }
  async function logout() {
    if (
      active &&
      !window.confirm("Sair e encerrar o treino em andamento sem registrá-lo?")
    )
      return;
    if (saving.current) return;
    setBusy(true);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      setNotice("Não foi possível sair. Tente novamente.");
      setBusy(false);
    }
  }
  function renderWorkout(workout: Workout) {
    return (
      <article className="large-workout" key={workout.id}>
        <div className="workout-icon gold-icon">
          <Dumbbell size={21} />
        </div>
        <div className="workout-copy">
          <strong>{workout.title}</strong>
          <span>
            {workout.focus || "Meu treino"} · {workout.exercises.length}{" "}
            exercícios · ~{workout.minutes} min
          </span>
        </div>
        <div className="workout-controls">
          <button
            className="icon-button"
            aria-label={`Editar ${workout.title}`}
            disabled={busy}
            onClick={() => {
              setDraft(structuredClone(workout));
              setActiveTab("Treinos");
            }}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Excluir ${workout.title}`}
            disabled={busy}
            onClick={() => void removeWorkout(workout)}
          >
            <Trash2 size={16} />
          </button>
          <button
            className="small-start"
            disabled={busy || Boolean(active) || !workout.exercises.length}
            onClick={() => startWorkout(workout)}
          >
            INICIAR <Play size={14} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            className="sidebar-brand-logo"
            src="/summer-fit-brand.jpeg"
            alt="Summer Fit — A academia que vai esquentar o seu dia"
            width={200}
            height={56}
          />
        </div>
        <div className="sidebar-profile">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{displayName}</strong>
            <small>{paid ? "Summer PRO" : "Summer Grátis"}</small>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              aria-current={activeTab === label ? "page" : undefined}
              className={activeTab === label ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab(label)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {access?.is_admin && (
            <a className="nav-item admin-link" href="/admin">
              <ShieldCheck size={19} />
              Administrar alunos
            </a>
          )}
          <button className="sidebar-plan" onClick={() => setActiveTab("Plano")}>
            <Crown size={20} /><span><strong>{paid ? "Meu Summer PRO" : "Conheça o Summer PRO"}</strong><small>{paid ? "Plano e renovação" : "Mais cuidado com sua evolução"}</small></span><ChevronRight size={16} />
          </button>
          <button className="help-link" onClick={() => setShowHelp(!showHelp)}>
            <CircleHelp size={17} />
            Como usar
          </button>
          <button
            className="help-link"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut size={17} />
            Sair da conta
          </button>
        </div>
      </aside>
      <section className="content-area">
        <header className="topbar">
          <div className="topbar-location">
            <img className="header-academy-logo" src="/summer-fit-brand.jpeg" alt="Summer Fit" width={180} height={50} />
            <span className={online ? "status-dot" : "status-dot offline"} />
            <span className="header-current-tab">{activeTab === "Plano" ? "Planos" : activeTab}</span>
          </div>
          <div className="topbar-actions">
            <button className="account-plan-badge" onClick={() => setActiveTab("Plano")}><Crown size={14} />{paid ? "PRO" : "Grátis"}</button>
            <button
              className="icon-button"
              onClick={() => setShowHelp(!showHelp)}
              aria-label="Como usar"
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="top-avatar"
              aria-label="Abrir meu perfil"
              onClick={() => setActiveTab("Perfil")}
            >
              {initials}
            </button>
          </div>
        </header>
        <div className="page-content" id="main-content">
          {activeTab === "Início" && <div className="welcome-row">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <h1>
                Olá, {displayName.split(" ")[0]}{" "}
                <Sun size={30} aria-hidden="true" />
              </h1>
              <p className="lead">
                Seu ritmo. Seus objetivos. Um treino de cada vez.
              </p>
            </div>
            <button
              className="secondary-button calendar-button"
              disabled={busy}
              onClick={openAddWorkout}
            >
              <Plus size={17} />
              Adicionar treino
            </button>
          </div>}
          {!online && <p className="notice" role="alert">Você está sem internet. As alterações precisam de conexão para serem salvas.</p>}
          <div aria-live="polite" aria-atomic="true">
            {notice && (
              <div className="notice">
                {notice}
                <button
                  className="icon-button"
                  onClick={() => setNotice("")}
                  aria-label="Fechar aviso"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          {!dataReady && dataLoading && <PanelLoading />}
          {!dataReady && !dataLoading && (
            <div className="notice">
              Suas fichas ainda não foram carregadas.
              <button
                className="secondary-button"
                onClick={() => void loadFitness()}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {showHelp && (
            <section className="help-card">
              <div className="section-heading">
                <h2>Seu treino, sempre à mão.</h2>
                <button
                  className="icon-button"
                  onClick={() => setShowHelp(false)}
                  aria-label="Fechar ajuda"
                >
                  <X size={18} />
                </button>
              </div>
              <p>
                Crie uma ficha, adicione exercícios e toque em Iniciar. Marque
                os exercícios e conclua para registrar o tempo e a frequência.
              </p>
              <p>
                As fichas e os últimos {MAX_SESSIONS} treinos concluídos ficam
                na sua conta. Você precisa de internet para entrar e salvar. Use
                apenas um aparelho por vez para editar.
              </p>
              <p>
                <strong>No iPhone:</strong> abra no Safari, toque em
                Compartilhar e em Adicionar à Tela de Início. No Android,
                procure essa opção no menu do navegador.
              </p>
            </section>
          )}
          {active && (
            <section className="session-card" aria-label="Treino em andamento">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">EM MOVIMENTO</p>
                  <h2>{active.workout.title}</h2>
                </div>
                <WorkoutClock startedAt={active.startedAt} />
              </div>
              <p>
                Marque cada exercício quando terminar. {checked.length}/
                {active.workout.exercises.length} concluídos.
              </p>
              <div className="exercise-checklist">
                {active.workout.exercises.map((exercise) => (
                  <label key={exercise.id}>
                    <input
                      type="checkbox"
                      checked={checked.includes(exercise.id)}
                      onChange={(e) =>
                        setChecked((current) =>
                          e.target.checked
                            ? [...current, exercise.id]
                            : current.filter((id) => id !== exercise.id),
                        )
                      }
                    />
                    <span>
                      <strong>{exercise.name}</strong>
                      <small>
                        {exercise.sets} séries × {exercise.reps}
                        {typeof exercise.weight === "number"
                          ? ` · ${exercise.weight} ${exercise.weightUnit || "kg"}`
                          : ""}
                        {typeof exercise.restSeconds === "number"
                          ? ` · descanso ${exercise.restSeconds}s`
                          : ""}
                      </small>
                      {exercise.notes && <small>{exercise.notes}</small>}
                    </span>
                  </label>
                ))}
              </div>
              <RestTimer />
              <div className="session-actions">
                <button
                  className="primary-button"
                  disabled={
                    busy || checked.length !== active.workout.exercises.length
                  }
                  onClick={() => void finishWorkout()}
                >
                  <Check size={18} />
                  {busy ? "SALVANDO..." : "CONCLUIR TREINO"}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Encerrar sem registrar este treino?"))
                      setActive(null);
                  }}
                >
                  Encerrar sem salvar
                </button>
              </div>
            </section>
          )}
          {activeTab === "Início" && dataReady && (
            <>
              <section className="hero-card">
                <div className="hero-content">
                  <div className="pill">
                    {first
                      ? "PRONTO PARA SE MOVIMENTAR?"
                      : "SUA JORNADA COMEÇA AQUI"}
                  </div>
                  <h2>
                    {first
                      ? first.title
                      : "Um plano para\no seu próximo passo."}
                  </h2>
                  <p>
                    {first
                      ? `${first.focus || "Seu treino"} · ${first.exercises.length} exercícios · ~${first.minutes} min`
                      : "Fotografe sua ficha da academia ou monte seu treino manualmente."}
                  </p>
                  <div className="hero-actions">
                    <button
                      className="hero-primary"
                      disabled={busy || Boolean(active)}
                      onClick={() =>
                        first ? startWorkout(first) : openAddWorkout()
                      }
                    >
                      {first ? <Play size={17} /> : <Plus size={17} />}
                      {first ? "COMEÇAR TREINO" : "ADICIONAR TREINO"}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="hero-word" aria-hidden="true">
                  FIT.
                </div>
                <img
                  className="hero-mascot"
                  src="/summer-fit-mascot.jpeg"
                  alt=""
                  aria-hidden="true"
                />
              </section>
              <div className="stats-grid">
                <article className="stat-card">
                  <div className="stat-icon yellow">
                    <Target size={18} />
                  </div>
                  <div className="stat-title">META DA SEMANA</div>
                  <strong>
                    {summary.count} <small>/ {fitness.goal} treinos</small>
                  </strong>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuenow={Math.min(summary.count, fitness.goal)}
                    aria-valuemin={0}
                    aria-valuemax={fitness.goal}
                    aria-label="Meta semanal"
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p className="neutral">
                    {summary.count >= fitness.goal
                      ? "Meta alcançada. Celebre sua constância!"
                      : "Cada treino concluído te leva mais longe."}
                  </p>
                </article>
                <article className="stat-card">
                  <div className="stat-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="stat-title">TEMPO EM MOVIMENTO</div>
                  <strong>
                    {summary.minutes} <small>min nesta semana</small>
                  </strong>
                  <p className="neutral">
                    Tempo registrado nos treinos concluídos
                  </p>
                </article>
                <article className="stat-card premium-stat">
                  <div className="stat-icon yellow">
                    <Dumbbell size={18} />
                  </div>
                  <div className="stat-title">DO SEU JEITO</div>
                  <strong>
                    {fitness.workouts.length} <small>fichas de treino</small>
                  </strong>
                  <p className="neutral">Organizadas e salvas na sua conta</p>
                </article>
              </div>
              <div className="home-shortcuts" aria-label="Acesso rápido">
                <button onClick={openAddWorkout}><span className="shortcut-icon"><Camera size={22} /></span><span><strong>Importar minha ficha</strong><small>Do papel para o celular</small></span><ChevronRight size={18} /></button>
                <button onClick={() => setActiveTab("Nutrição")}><span className="shortcut-icon"><Utensils size={22} /></span><span><strong>Minha nutrição</strong><small>{paid ? "Cardápio, foto e substituições com IA" : "Conheça os recursos do Summer PRO"}</small></span><ChevronRight size={18} /></button>
              </div>
              {paid ? (
                <section className="nutrition-home-card pro-active-home">
                  <div className="nutrition-home-icon">
                    <Utensils size={24} />
                  </div>
                  <div>
                    <p className="eyebrow">SUMMER PRO ATIVO</p>
                    <h3>Seu painel nutricional está liberado</h3>
                    <p>
                      Acompanhe calorias, registre refeições por foto e faça
                      substituições com IA.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setActiveTab("Nutrição")}
                  >
                    ABRIR NUTRIÇÃO
                  </button>
                </section>
              ) : (
                <section className="nutrition-home-card locked-home-card">
                  <div className="nutrition-home-icon locked">
                    <LockKeyhole size={23} />
                  </div>
                  <div>
                    <p className="eyebrow">NUTRIÇÃO IA</p>
                    <h3>Cardápio, registro por foto e substituições com IA</h3>
                    <p>
                      Organize sua alimentação e acompanhe calorias e
                      macronutrientes de forma simples.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setShowPaywall(true)}
                  >
                    CONHECER SUMMER PRO
                  </button>
                </section>
              )}
              <div className="section-heading">
                <div>
                  <h3>Meus treinos</h3>
                  <p>Seu próximo passo está aqui.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActiveTab("Treinos")}
                >
                  Ver todos <ChevronRight size={16} />
                </button>
              </div>
              <div className="workout-list">
                {fitness.workouts.slice(0, 3).map(renderWorkout)}
              </div>
              {!first && (
                <div className="empty-state">
                  <Dumbbell size={30} />
                  <h3>Uma ficha com a sua cara.</h3>
                  <p>
                    Importe a ficha de papel por foto ou adicione os exercícios
                    manualmente.
                  </p>
                  <button className="primary-button" onClick={openAddWorkout}>
                    <Plus size={17} />
                    ADICIONAR PRIMEIRO TREINO
                  </button>
                </div>
              )}
            </>
          )}
          {activeTab === "Treinos" && (
            <section className="tab-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SUA ROTINA, ORGANIZADA</p>
                  <h2 className="panel-title">Meus treinos</h2>
                  <p>
                    {fitness.workouts.length} de {MAX_WORKOUTS} fichas
                  </p>
                </div>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={openAddWorkout}
                >
                  <Plus size={17} />
                  ADICIONAR TREINO
                </button>
              </div>
              {draft && (
                <form className="form-card workout-form" onSubmit={saveWorkout}>
                  <div className="section-heading">
                    <h3>
                      {fitness.workouts.some((w) => w.id === draft.id)
                        ? "Editar ficha"
                        : "Nova ficha"}
                    </h3>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={busy}
                      onClick={() => setDraft(null)}
                      aria-label="Fechar edição"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <label>
                    Nome do treino
                    <input
                      autoFocus
                      value={draft.title}
                      maxLength={80}
                      onChange={(e) =>
                        setDraft({ ...draft, title: e.target.value })
                      }
                      placeholder="Ex.: Treino A — superiores"
                      required
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Objetivo ou foco
                      <input
                        value={draft.focus}
                        maxLength={100}
                        onChange={(e) =>
                          setDraft({ ...draft, focus: e.target.value })
                        }
                        placeholder="Ex.: Força e hipertrofia"
                      />
                    </label>
                    <label>
                      Tempo planejado (min)
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={draft.minutes || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            minutes: Number(e.target.value),
                          })
                        }
                        required
                      />
                    </label>
                  </div>
                  <h4>Exercícios</h4>
                  {draft.exercises.map((exercise, index) => (
                    <div className="exercise-editor" key={exercise.id}>
                      <label className="exercise-name">
                        Exercício {index + 1}
                        <input
                          value={exercise.name}
                          maxLength={80}
                          required
                          placeholder="Ex.: Supino reto"
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              exercises: draft.exercises.map((x) =>
                                x.id === exercise.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Séries
                        <input
                          type="number"
                          min={1}
                          max={20}
                          required
                          value={exercise.sets || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              exercises: draft.exercises.map((x) =>
                                x.id === exercise.id
                                  ? { ...x, sets: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Repetições
                        <input
                          value={exercise.reps}
                          maxLength={40}
                          required
                          placeholder="10–12"
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              exercises: draft.exercises.map((x) =>
                                x.id === exercise.id
                                  ? { ...x, reps: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={draft.exercises.length === 1}
                        aria-label={`Remover exercício ${index + 1}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            exercises: draft.exercises.filter(
                              (x) => x.id !== exercise.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="exercise-extra">
                        <label>
                          Carga
                          <input
                            type="number"
                            min={0}
                            max={2000}
                            step="0.5"
                            placeholder="Opcional"
                            value={exercise.weight ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                exercises: draft.exercises.map((x) =>
                                  x.id === exercise.id
                                    ? {
                                        ...x,
                                        weight: e.target.value
                                          ? Number(e.target.value)
                                          : undefined,
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Unidade
                          <select
                            value={exercise.weightUnit || "kg"}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                exercises: draft.exercises.map((x) =>
                                  x.id === exercise.id
                                    ? {
                                        ...x,
                                        weightUnit: e.target.value as
                                          | "kg"
                                          | "lb",
                                      }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                          </select>
                        </label>
                        <label>
                          Descanso (s)
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            placeholder="Opcional"
                            value={exercise.restSeconds ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                exercises: draft.exercises.map((x) =>
                                  x.id === exercise.id
                                    ? {
                                        ...x,
                                        restSeconds: e.target.value
                                          ? Number(e.target.value)
                                          : undefined,
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label className="exercise-notes">
                          Observações
                          <textarea
                            rows={2}
                            maxLength={240}
                            placeholder="Opcional"
                            value={exercise.notes || ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                exercises: draft.exercises.map((x) =>
                                  x.id === exercise.id
                                    ? { ...x, notes: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={draft.exercises.length >= 20}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        exercises: [
                          ...draft.exercises,
                          {
                            id: crypto.randomUUID(),
                            name: "",
                            sets: 3,
                            reps: "10–12",
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={17} />
                    Adicionar exercício ({draft.exercises.length}/20)
                  </button>
                  <button
                    className="primary-button full-button"
                    disabled={busy}
                  >
                    {busy ? "SALVANDO..." : "SALVAR FICHA"}
                  </button>
                </form>
              )}
              <label className="search-label">
                Buscar ficha
                <input
                  type="search"
                  placeholder="Nome do treino ou foco muscular"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="panel-list">{filtered.map(renderWorkout)}</div>
              {!filtered.length && (
                <div className="empty-state">
                  <Dumbbell size={28} />
                  <h3>
                    {search
                      ? "Nenhuma ficha encontrada"
                      : "Seu espaço está pronto."}
                  </h3>
                  <p>
                    {search
                      ? "Tente outro nome ou foco muscular."
                      : "Toque em Novo treino para criar sua primeira ficha."}
                  </p>
                </div>
              )}
            </section>
          )}
          {activeTab === "Progresso" && (
            <section className="tab-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CADA TREINO CONTA</p>
                  <h2 className="panel-title">Sua evolução</h2>
                  <p>Registros reais, no seu ritmo.</p>
                </div>
              </div>
              <div className="progress-highlight">
                <div>
                  <div className="stat-title">TREINOS NESTA SEMANA</div>
                  <strong>{summary.count}</strong>
                  <p>{summary.minutes} minutos em movimento</p>
                </div>
                <div>
                  <strong>{progress}%</strong>
                  <span>da meta semanal</span>
                </div>
              </div>
              {paid ? (
                <>
                  <article className="chart-card">
                    <div className="section-heading">
                      <h3>Frequência semanal</h3>
                      <span>Segunda a domingo</span>
                    </div>
                    <div className="chart">
                      {summary.counts.map((count, index) => (
                        <div
                          className="bar-column"
                          key={days[index]}
                          aria-label={`${days[index]}: ${count} treinos`}
                        >
                          <strong>{count}</strong>
                          <div className="bar-track">
                            <i
                              style={{
                                height: `${(count / Math.max(1, ...summary.counts)) * 100}%`,
                              }}
                            />
                          </div>
                          <small>{days[index]}</small>
                        </div>
                      ))}
                    </div>
                  </article>
                  <ProProgressInsights sessions={fitness.sessions} />
                </>
              ) : (
                <section className="progress-pro-lock">
                  <div className="nutrition-home-icon locked">
                    <LockKeyhole size={23} />
                  </div>
                  <div>
                    <p className="eyebrow">SUMMER PRO</p>
                    <h3>Gráficos e histórico completo</h3>
                    <p>
                      Veja evolução de cargas, estatísticas e recordes pessoais.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setShowPaywall(true)}
                  >
                    CONHECER PRO
                  </button>
                </section>
              )}
              <div className="section-heading">
                <div>
                  <h3>Histórico recente</h3>
                  <p>
                    {paid
                      ? "Últimos treinos concluídos, do mais recente ao mais antigo."
                      : "Seu histórico básico mostra os 3 treinos mais recentes."}
                  </p>
                </div>
              </div>
              <div className="workout-list">
                {fitness.sessions
                  .slice(paid ? -MAX_SESSIONS : -3)
                  .reverse()
                  .map((session) => (
                    <article className="workout-row" key={session.id}>
                      <div className="workout-icon gold-icon">
                        <Check size={20} />
                      </div>
                      <div className="workout-copy">
                        <strong>{session.title}</strong>
                        <span>
                          {new Date(session.completedAt).toLocaleString(
                            "pt-BR",
                            { dateStyle: "short", timeStyle: "short" },
                          )}
                        </span>
                      </div>
                      <span>{session.minutes} min</span>
                    </article>
                  ))}
              </div>
              {!fitness.sessions.length && (
                <div className="empty-state">
                  <TrendingUp size={28} />
                  <h3>A primeira conquista vem aí.</h3>
                  <p>Conclua um treino para começar seu histórico.</p>
                </div>
              )}
            </section>
          )}
          {activeTab === "Plano" && (
            <PlanPanel access={access} onOpenNutrition={() => setActiveTab("Nutrição")} />
          )}
          {paid && (nutritionVisited || activeTab === "Nutrição") && <div hidden={activeTab !== "Nutrição"}>
            <ProWorkspace onRefresh={refreshAccess} active={activeTab === "Nutrição"} />
          </div>}
          {!paid && activeTab === "Nutrição" && <section className="nutrition-locked-page">
            <span className="pro-hero-icon"><Utensils size={28} /></span>
            <p className="eyebrow">SUMMER PRO</p><h1>Cuide da alimentação.<br />Evolua no seu ritmo.</h1>
            <p>Cardápio de 7 dias, alimentação por foto, substituições com IA, metas, água e lista de compras.</p>
            <div className="locked-feature-grid"><span>Cardápio com IA</span><span>Foto da alimentação</span><span>Substituição com IA</span><span>Diário e controle de água</span><span>Calorias e macros</span><span>Lista de compras</span></div>
            <button className="primary-button" onClick={() => setActiveTab("Plano")}><Crown size={18} />Conhecer Summer PRO<ArrowRight size={18} /></button>
            <small>Seus treinos e a importação por foto continuam gratuitos.</small>
          </section>}
          {!paid && activeTab === "Nutrição" && <NutritionistCard />}
          {activeTab === "Perfil" && (
            <section className="tab-panel profile-panel">
              <div className="profile-big-avatar">{initials}</div>
              <p className="eyebrow">SEU PERFIL</p>
              <h2 className="panel-title">{displayName}</h2>
              <p className="lead profile-email">{user.email}</p>
              <section
                className={
                  paid ? "profile-plan-card pro" : "profile-plan-card free"
                }
              >
                <div className="profile-plan-icon">
                  {paid ? <Crown size={23} /> : <Dumbbell size={23} />}
                </div>
                <div>
                  <span>Plano atual</span>
                  <strong>{paid ? "⭐ Summer PRO" : "Summer Grátis"}</strong>
                  {paid ? (
                    <small>
                      {subscriptionPlanLabel(access?.subscription_plan)} · início{" "}
                      {access?.subscription_started_at
                        ? new Date(
                            access.subscription_started_at,
                          ).toLocaleDateString("pt-BR")
                        : "—"}
                      {" · "}renovação/vencimento{" "}
                      {effectiveExpiresAt(access)
                        ? new Date(
                            effectiveExpiresAt(access) as string,
                          ).toLocaleDateString("pt-BR")
                        : "—"}
                    </small>
                  ) : (
                    <small>
                      {effectiveStatus(access) === "expired"
                        ? "Seu Summer PRO anterior venceu. Seus treinos gratuitos continuam disponíveis."
                        : effectiveStatus(access) === "cancelled"
                          ? "Assinatura cancelada. Seus treinos gratuitos continuam disponíveis."
                          : "Treinos e digitalização de ficha disponíveis gratuitamente."}
                    </small>
                  )}
                </div>
                <button
                  className={paid ? "secondary-button" : "primary-button"}
                  onClick={() => setActiveTab("Plano")}
                  type="button"
                >
                  {paid ? "VER ASSINATURA" : "CONHECER SUMMER PRO"}
                </button>
              </section>
              <form
                className="form-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!name.trim()) return;
                  void persist(
                    (current) => ({ ...current, goal }),
                    "Preferências atualizadas.",
                    { name: name.trim() },
                  );
                }}
              >
                <h3>Do seu jeito</h3>
                <label>
                  Como podemos chamar você?
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Meta de treinos por semana
                  <input
                    type="number"
                    min={1}
                    max={7}
                    required
                    value={goal || ""}
                    onChange={(e) => setGoal(Number(e.target.value))}
                  />
                </label>
                <button className="primary-button" disabled={busy}>
                  {busy ? "SALVANDO..." : "SALVAR PREFERÊNCIAS"}
                </button>
              </form>
              {access?.is_admin && (
                <a className="secondary-button admin-link" href="/admin">
                  <ShieldCheck size={17} />
                  Administrar alunos e planos
                </a>
              )}
              <p className="profile-note">
                Fichas e histórico são pessoais e ficam vinculados a esta conta.
                Para sincronizar, mantenha a conexão com a internet.
              </p>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void logout()}
              >
                <LogOut size={17} />
                Sair da conta
              </button>
            </section>
          )}
          <footer className="page-footer">
            SUMMER FIT <span>A academia que vai esquentar o seu dia.</span><small>Interface 28.09 · Comunidade desativada</small>
          </footer>
        </div>
        <nav className="mobile-nav" aria-label="Navegação mobile">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              aria-current={activeTab === label ? "page" : undefined}
              className={
                activeTab === label
                  ? "mobile-nav-item active"
                  : "mobile-nav-item"
              }
              onClick={() => setActiveTab(label)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </section>
      {showImporter && (
        <WorkoutImporter
          availableWorkoutSlots={MAX_WORKOUTS - fitness.workouts.length}
          onClose={() => {
            setShowImporter(false);
            setActiveTab("Treinos");
          }}
          onManual={createManualWorkout}
          onSave={saveImportedWorkouts}
        />
      )}
      {showPaywall && (
        <ProPaywall
          onClose={() => setShowPaywall(false)}
          onSubscribe={() => {
            setShowPaywall(false);
            setActiveTab("Plano");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </main>
  );
}
