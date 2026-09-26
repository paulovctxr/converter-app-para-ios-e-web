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
    }));
  return { version: 1, goal: number(data.goal, 3, 7), workouts, sessions };
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
