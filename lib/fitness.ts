export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: number;
  weightUnit?: "kg" | "lb";
  restSeconds?: number;
  notes?: string;
};
export type Workout = {
  id: string;
  title: string;
  focus: string;
  minutes: number;
  exercises: Exercise[];
};
export type WorkoutSession = {
  id: string;
  workoutId: string;
  title: string;
  completedAt: string;
  minutes: number;
  exercises?: WorkoutSessionExercise[];
};
export type WorkoutSessionExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  weight?: number;
  weightUnit?: "kg" | "lb";
};
export type FitnessData = {
  version: 1;
  goal: number;
  workouts: Workout[];
  sessions: WorkoutSession[];
};
export const MAX_WORKOUTS = 30;
export const MAX_SESSIONS = 180;
export const emptyFitness = (): FitnessData => ({
  version: 1,
  goal: 3,
  workouts: [],
  sessions: [],
});
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, fallback: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.round(value)))
    : fallback;
const optionalNumber = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(max, Math.round(value * 10) / 10)
    : undefined;

export function readFitness(value: unknown): FitnessData {
  if (!value || typeof value !== "object") return emptyFitness();
  const data = value as Partial<FitnessData>;
  const workouts = (Array.isArray(data.workouts) ? data.workouts : [])
    .filter((w) => w && typeof w === "object" && w.id && w.title)
    .slice(0, MAX_WORKOUTS)
    .map((w) => ({
      id: text(w.id, 80),
      title: text(w.title, 80),
      focus: text(w.focus, 100),
      minutes: number(w.minutes, 45, 240),
      exercises: (Array.isArray(w.exercises) ? w.exercises : [])
        .filter((e) => e && typeof e === "object" && e.name)
        .slice(0, 20)
        .map((e) => {
          const weight = optionalNumber(e.weight, 2000);
          const restSeconds = optionalNumber(e.restSeconds, 3600);
          const notes = text(e.notes, 240);
          return {
            id: text(e.id, 80),
            name: text(e.name, 80),
            sets: number(e.sets, 3, 20),
            reps: text(e.reps, 40) || "10–12",
        ...(weight === undefined
          ? {}
          : {
              weight,
              ...(e.weightUnit === "kg" || e.weightUnit === "lb"
                ? { weightUnit: e.weightUnit }
                : {}),
            }),
            ...(restSeconds === undefined ? {} : { restSeconds }),
            ...(notes ? { notes } : {}),
          };
        }),
    }));
  const sessions = (Array.isArray(data.sessions) ? data.sessions : [])
    .filter(
      (s) =>
        s &&
        typeof s === "object" &&
        s.id &&
        Number.isFinite(Date.parse(s.completedAt)),
    )
    .slice(-MAX_SESSIONS)
    .map((s) => ({
      id: text(s.id, 80),
      workoutId: text(s.workoutId, 80),
      title: text(s.title, 80),
      completedAt: s.completedAt,
      minutes: number(s.minutes, 1, 240),
      exercises: (Array.isArray(s.exercises) ? s.exercises : [])
        .filter((e) => e && typeof e === "object" && e.name)
        .slice(0, 20)
        .map((e) => {
          const weight = optionalNumber(e.weight, 2000);
          return {
            exerciseId: text(e.exerciseId, 80),
            name: text(e.name, 80),
            sets: number(e.sets, 1, 20),
            reps: text(e.reps, 40) || "—",
            ...(weight === undefined
              ? {}
              : {
                  weight,
                  weightUnit:
                    e.weightUnit === "lb" ? ("lb" as const) : ("kg" as const),
                }),
          };
        }),
    }));
  return { version: 1, goal: number(data.goal, 3, 7), workouts, sessions };
}

function dayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function proProgressInsights(
  sessions: WorkoutSession[],
  now = new Date(),
) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const completedDays = new Set(sessions.map((session) => dayKey(session.completedAt)));
  let streakDays = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!completedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (completedDays.has(dayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const records = new Map<
    string,
    { name: string; weightKg: number; completedAt: string }
  >();
  const progress = new Map<
    string,
    { name: string; points: { weightKg: number; completedAt: string }[] }
  >();
  for (const session of sessions) {
    for (const exercise of session.exercises || []) {
      if (typeof exercise.weight !== "number") continue;
      const weightKg =
        exercise.weightUnit === "lb"
          ? Math.round(exercise.weight * 0.453592 * 10) / 10
          : exercise.weight;
      const key = exercise.name.trim().toLocaleLowerCase("pt-BR");
      if (!key) continue;
      const previous = records.get(key);
      if (!previous || weightKg > previous.weightKg)
        records.set(key, {
          name: exercise.name,
          weightKg,
          completedAt: session.completedAt,
        });
      const series = progress.get(key) || { name: exercise.name, points: [] };
      series.points.push({ weightKg, completedAt: session.completedAt });
      progress.set(key, series);
    }
  }
  for (const series of progress.values())
    series.points.sort(
      (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt),
    );
  return {
    totalSessions: sessions.length,
    totalMinutes: sessions.reduce((total, session) => total + session.minutes, 0),
    averageMinutes: sessions.length
      ? Math.round(
          sessions.reduce((total, session) => total + session.minutes, 0) /
            sessions.length,
        )
      : 0,
    monthSessions: sessions.filter(
      (session) => new Date(session.completedAt) >= monthStart,
    ).length,
    streakDays,
    records: Array.from(records.values()).sort(
      (a, b) => b.weightKg - a.weightKg,
    ),
    progress: Array.from(progress.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    ),
  };
}
export function weekSummary(sessions: WorkoutSession[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const week = sessions.filter((s) => {
    const date = new Date(s.completedAt);
    return date >= start && date < end;
  });
  const counts = Array.from(
    { length: 7 },
    (_, day) =>
      week.filter((s) => (new Date(s.completedAt).getDay() + 6) % 7 === day)
        .length,
  );
  return {
    count: week.length,
    minutes: week.reduce((sum, s) => sum + s.minutes, 0),
    counts,
  };
}
export function safeRedirectPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/";
  try {
    const base = "https://summer.invalid";
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
