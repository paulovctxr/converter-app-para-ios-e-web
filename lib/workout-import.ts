import type { Workout } from "@/lib/fitness";

export const MAX_IMPORT_IMAGES = 4;
export const MAX_IMPORT_WORKOUTS = 8;
export const MAX_IMPORT_EXERCISES = 20;
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_PREPARED_IMAGE_BYTES = 2_400_000;

export type ImportConfidence = "high" | "medium" | "low";
export type ImportedExercise = {
  id: string;
  name: string;
  sets: number | null;
  repetitions: string;
  weight: number | null;
  weightUnit: "kg" | "lb" | null;
  restSeconds: number | null;
  notes: string;
  confidence: ImportConfidence;
  needsReview: boolean;
};
export type ImportedWorkout = {
  id: string;
  name: string;
  focus: string;
  exercises: ImportedExercise[];
};
export type WorkoutImportAnalysis = {
  quality: "good" | "low";
  qualityIssues: string[];
  workouts: ImportedWorkout[];
};
export type WorkoutImportAccess = {
  is_pro: boolean;
  allowed: boolean;
  used: number;
  remaining: number;
  monthly_limit: number;
  free_trial_limit: number;
  period_ends_at: string | null;
  server_time: string;
};
export type PreparedWorkoutImage = {
  data: string;
  mimeType: "image/jpeg";
  size: number;
};

const cleanText = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const nullableNumber = (value: unknown, max: number, integer = false) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    return null;
  return integer ? Math.round(value) : Math.round(value * 10) / 10;
};
const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `import-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function normalizeWorkoutImport(value: unknown): WorkoutImportAnalysis {
  const root = object(value);
  const rawWorkouts = Array.isArray(root.workouts) ? root.workouts : [];
  const workouts = rawWorkouts
    .slice(0, MAX_IMPORT_WORKOUTS)
    .map((rawWorkout, workoutIndex) => {
      const workout = object(rawWorkout);
      const seen = new Set<string>();
      const rawExercises = Array.isArray(workout.exercises)
        ? workout.exercises
        : [];
      const exercises = rawExercises
        .slice(0, MAX_IMPORT_EXERCISES)
        .flatMap((rawExercise) => {
          const exercise = object(rawExercise);
          const name = cleanText(exercise.name, 80) || "Não identificado";
          const sets = nullableNumber(exercise.sets, 20, true);
          const repetitions = cleanText(
            exercise.repetitions ?? exercise.reps,
            40,
          );
          const weight = nullableNumber(exercise.weight, 2000);
      const weightUnit: "kg" | "lb" | null =
            exercise.weightUnit === "kg" || exercise.weightUnit === "lb"
              ? exercise.weightUnit
              : null;
          const restSeconds = nullableNumber(exercise.restSeconds, 3600, true);
          const notes = cleanText(exercise.notes, 240);
          const confidence: ImportConfidence =
            exercise.confidence === "high" || exercise.confidence === "medium"
              ? exercise.confidence
              : "low";
          const needsReview =
            Boolean(exercise.needsReview) ||
            confidence === "low" ||
            name === "Não identificado" ||
            sets === null ||
            !repetitions;
          const signature = [
            name.toLocaleLowerCase("pt-BR"),
            sets,
            repetitions.toLocaleLowerCase("pt-BR"),
            weight,
            weightUnit,
            restSeconds,
            notes.toLocaleLowerCase("pt-BR"),
          ].join("|");
          if (seen.has(signature)) return [];
          seen.add(signature);
          return [
            {
              id: id(),
              name,
              sets,
              repetitions,
              weight,
              weightUnit,
              restSeconds,
              notes,
              confidence,
              needsReview,
            },
          ];
        });
      return {
        id: id(),
        name:
          cleanText(workout.name ?? workout.workoutName, 80) ||
          `Treino ${String.fromCharCode(65 + workoutIndex)}`,
        focus: cleanText(workout.focus, 100),
        exercises,
      };
    })
    .filter((workout) => workout.exercises.length > 0);
  const issues = (Array.isArray(root.qualityIssues) ? root.qualityIssues : [])
    .map((issue) => cleanText(issue, 120))
    .filter(Boolean)
    .slice(0, 6);
  const quality = root.quality === "good" && workouts.length ? "good" : "low";
  return { quality, qualityIssues: issues, workouts };
}

export function validateWorkoutImport(
  analysis: WorkoutImportAnalysis,
  availableWorkoutSlots = MAX_IMPORT_WORKOUTS,
): string[] {
  const errors: string[] = [];
  if (!analysis.workouts.length)
    errors.push("Nenhum treino legível foi encontrado.");
  if (analysis.workouts.length > availableWorkoutSlots)
    errors.push(
      `Você tem espaço para apenas ${availableWorkoutSlots} treino(s). Exclua um bloco antes de salvar.`,
    );
  for (const workout of analysis.workouts) {
    if (!workout.name.trim())
      errors.push("Preencha o nome de todos os treinos.");
    if (!workout.exercises.length)
      errors.push(
        `Adicione ao menos um exercício em “${workout.name || "Treino"}”.`,
      );
    for (const exercise of workout.exercises) {
      if (!exercise.name.trim() || exercise.name === "Não identificado")
        errors.push(
          `Informe o nome do exercício pendente em “${workout.name || "Treino"}”.`,
        );
      if (exercise.sets === null || exercise.sets < 1 || exercise.sets > 20)
        errors.push(`Confira as séries de “${exercise.name}”.`);
      if (!exercise.repetitions.trim())
        errors.push(`Confira as repetições de “${exercise.name}”.`);
    }
  }
  return [...new Set(errors)];
}

export function workoutImportToFitness(
  analysis: WorkoutImportAnalysis,
): Workout[] {
  const errors = validateWorkoutImport(analysis);
  if (errors.length) throw new Error(errors[0]);
  return analysis.workouts.map((workout) => ({
    id: id(),
    title: workout.name.trim(),
    focus: workout.focus.trim(),
    minutes: Math.max(15, Math.min(240, workout.exercises.length * 6)),
    exercises: workout.exercises.map((exercise) => ({
      id: id(),
      name: exercise.name.trim(),
      sets: exercise.sets as number,
      reps: exercise.repetitions.trim(),
      ...(exercise.weight === null
        ? {}
        : {
            weight: exercise.weight,
            ...(exercise.weightUnit
              ? { weightUnit: exercise.weightUnit }
              : {}),
          }),
      ...(exercise.restSeconds === null
        ? {}
        : { restSeconds: exercise.restSeconds }),
      ...(exercise.notes.trim() ? { notes: exercise.notes.trim() } : {}),
    })),
  }));
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível preparar esta imagem.")),
      "image/jpeg",
      quality,
    ),
  );
}

async function imageSource(
  file: File,
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if ("createImageBitmap" in globalThis) {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Formato de imagem não suportado."));
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function blobBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk)
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

export async function prepareWorkoutImage(
  file: File,
): Promise<PreparedWorkoutImage> {
  if (!file.type.startsWith("image/"))
    throw new Error("Selecione apenas arquivos de imagem.");
  if (file.size > MAX_SOURCE_IMAGE_BYTES)
    throw new Error(
      "Esta foto é muito grande. Escolha uma imagem de até 15 MB.",
    );
  const loaded = await imageSource(file).catch(() => {
    throw new Error("Não conseguimos abrir esta foto. Use JPG, PNG ou WEBP.");
  });
  try {
    if (!loaded.width || !loaded.height)
      throw new Error("A imagem está vazia.");
    const render = async (maxSide: number, quality: number) => {
      const scale = Math.min(
        1,
        maxSide / Math.max(loaded.width, loaded.height),
      );
      const width = Math.max(1, Math.round(loaded.width * scale));
      const height = Math.max(1, Math.round(loaded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context)
        throw new Error("Seu navegador não conseguiu preparar a imagem.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(loaded.source, 0, 0, width, height);
      return canvasBlob(canvas, quality);
    };
    let blob = await render(2200, 0.86);
    if (blob.size > MAX_PREPARED_IMAGE_BYTES) blob = await render(1700, 0.72);
    if (blob.size > MAX_PREPARED_IMAGE_BYTES) blob = await render(1300, 0.62);
    if (blob.size > MAX_PREPARED_IMAGE_BYTES)
      throw new Error(
        "Não foi possível reduzir esta foto. Tente fotografar novamente mais perto da ficha.",
      );
    return {
      data: await blobBase64(blob),
      mimeType: "image/jpeg",
      size: blob.size,
    };
  } finally {
    loaded.close();
  }
}
