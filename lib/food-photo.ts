import type { MealType } from "@/lib/nutrition";
import { prepareWorkoutImage } from "@/lib/workout-import";

export type FoodPhotoMeal = {
  label: string;
  meal_type: MealType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "high" | "medium" | "low";
  notes: string;
};

export type FoodPhotoAnalysis = {
  quality: "good" | "low";
  qualityIssues: string[];
  meal: FoodPhotoMeal | null;
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
const number = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value * 10) / 10))
    : null;
const mealTypes: MealType[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "supper",
  "other",
];

export function normalizeFoodPhoto(value: unknown): FoodPhotoAnalysis {
  const root = object(value);
  const issues = (Array.isArray(root.qualityIssues)
    ? root.qualityIssues
    : []
  )
    .map((issue) => text(issue, 120))
    .filter(Boolean)
    .slice(0, 5);
  const rawMeal = object(root.meal);
  const label = text(rawMeal.label, 100);
  const calories = number(rawMeal.calories, 1, 5000);
  const protein = number(rawMeal.protein_g, 0, 500);
  const carbs = number(rawMeal.carbs_g, 0, 800);
  const fat = number(rawMeal.fat_g, 0, 500);
  if (
    !label ||
    calories === null ||
    protein === null ||
    carbs === null ||
    fat === null
  ) {
    return {
      quality: "low",
      qualityIssues: issues,
      meal: null,
    };
  }
  const mealType = mealTypes.includes(rawMeal.meal_type as MealType)
    ? (rawMeal.meal_type as MealType)
    : "other";
  const confidence =
    rawMeal.confidence === "high" || rawMeal.confidence === "medium"
      ? rawMeal.confidence
      : "low";
  return {
    quality: root.quality === "good" ? "good" : "low",
    qualityIssues: issues,
    meal: {
      label,
      meal_type: mealType,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      confidence,
      notes: text(rawMeal.notes, 240),
    },
  };
}

export async function prepareFoodPhoto(file: File) {
  try {
    return await prepareWorkoutImage(file);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não conseguimos abrir a foto.";
    throw new Error(message.replace(/ficha/gi, "refeição"));
  }
}
