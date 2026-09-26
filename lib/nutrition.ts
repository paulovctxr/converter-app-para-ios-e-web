export type NutritionGoal = "lose_fat" | "maintain" | "gain_muscle";
export type ActivityLevel = "low" | "moderate" | "high";
export type DietaryPreference =
  | "balanced"
  | "vegetarian"
  | "vegan"
  | "low_lactose"
  | "gluten_free";
export type MealType =
  | "breakfast"
  | "lunch"
  | "snack"
  | "dinner"
  | "supper"
  | "other";

export type NutritionProfile = {
  user_id?: string;
  goal: NutritionGoal;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  dietary_preference: DietaryPreference;
  allergies: string;
  disliked_foods: string;
  meals_per_day: number;
  water_target_ml: number;
  updated_at?: string;
};

export type NutritionTargets = {
  calories_min: number;
  calories_max: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
};

export type Meal = {
  id: string;
  mealType: MealType;
  name: string;
  description: string;
  portion: string;
  ingredients: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
};

export type MealPlanDay = {
  day: string;
  meals: Meal[];
  totals: Omit<NutritionTargets, "calories_min" | "calories_max" | "water_ml"> & {
    calories: number;
  };
};

export type ShoppingItem = {
  category: string;
  name: string;
  quantity: string;
};

export type MealPlan = {
  id: number;
  profile_snapshot: NutritionProfile;
  targets: NutritionTargets;
  days: MealPlanDay[];
  shopping_list: ShoppingItem[];
  created_at: string;
  notes?: string[];
};

export type NutritionEntry = {
  id: string;
  label: string;
  meal_type: MealType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type WaterEntry = {
  id: number;
  amount_ml: number;
  created_at: string;
};

export type NutritionAccess = {
  is_pro: boolean;
  allowed: boolean;
  used: number;
  remaining: number;
  monthly_limit: number;
  period_ends_at: string;
};

export type ExerciseLibraryItem = {
  id: number;
  slug: string;
  name: string;
  muscle_group: string;
  equipment: string;
  difficulty: "Iniciante" | "Intermediário" | "Avançado";
  instructions: string[];
  tips: string[];
};

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  goal: "maintain",
  age: 25,
  height_cm: 170,
  weight_kg: 70,
  activity_level: "moderate",
  dietary_preference: "balanced",
  allergies: "",
  disliked_foods: "",
  meals_per_day: 4,
  water_target_ml: 2500,
};

export const GOAL_LABELS: Record<NutritionGoal, string> = {
  lose_fat: "Reduzir gordura",
  maintain: "Manter o peso",
  gain_muscle: "Ganhar massa muscular",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  low: "Baixa",
  moderate: "Moderada",
  high: "Alta",
};

export const DIET_LABELS: Record<DietaryPreference, string> = {
  balanced: "Equilibrada",
  vegetarian: "Vegetariana",
  vegan: "Vegana",
  low_lactose: "Pouca lactose",
  gluten_free: "Sem glúten",
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
  supper: "Ceia",
  other: "Outra refeição",
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value * 10) / 10))
    : min;

export function calculateNutritionTargets(
  profile: NutritionProfile,
): NutritionTargets {
  const kcalPerKg =
    profile.activity_level === "high"
      ? 36
      : profile.activity_level === "moderate"
        ? 32
        : 28;
  const adjustment =
    profile.goal === "lose_fat"
      ? -300
      : profile.goal === "gain_muscle"
        ? 250
        : 0;
  const center = Math.min(
    4500,
    Math.max(
      1400,
      Math.round((profile.weight_kg * kcalPerKg + adjustment) / 50) * 50,
    ),
  );
  const protein = Math.round(
    profile.weight_kg * (profile.goal === "maintain" ? 1.6 : 1.8),
  );
  const fat = Math.round(profile.weight_kg * 0.8);
  const carbs = Math.min(
    700,
    Math.max(100, Math.round((center - protein * 4 - fat * 9) / 4)),
  );
  return {
    calories_min: Math.max(1200, center - 100),
    calories_max: Math.min(4800, center + 100),
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    water_ml: profile.water_target_ml,
  };
}

export function nutritionTotals(entries: NutritionEntry[]) {
  return entries.reduce(
    (total, entry) => ({
      calories: total.calories + Number(entry.calories || 0),
      protein_g:
        Math.round((total.protein_g + Number(entry.protein_g || 0)) * 10) /
        10,
      carbs_g:
        Math.round((total.carbs_g + Number(entry.carbs_g || 0)) * 10) / 10,
      fat_g: Math.round((total.fat_g + Number(entry.fat_g || 0)) * 10) / 10,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function readMealPlan(value: unknown): MealPlan | null {
  const root = object(value);
  const rawDays = Array.isArray(root.days) ? root.days : [];
  const rawShopping = Array.isArray(root.shopping_list)
    ? root.shopping_list
    : [];
  if (!root.id || rawDays.length !== 7) return null;
  const days = rawDays.map((rawDay, dayIndex) => {
    const day = object(rawDay);
    const meals = (Array.isArray(day.meals) ? day.meals : [])
      .slice(0, 6)
      .map((rawMeal, mealIndex) => {
        const meal = object(rawMeal);
        const mealType =
          typeof meal.mealType === "string" &&
          Object.prototype.hasOwnProperty.call(MEAL_LABELS, meal.mealType)
          ? (meal.mealType as MealType)
          : "other";
        return {
          id: text(meal.id, 80) || `d${dayIndex + 1}-m${mealIndex + 1}`,
          mealType,
          name: text(meal.name, 100) || "Refeição",
          description: text(meal.description, 240),
          portion: text(meal.portion, 120),
          ingredients: (Array.isArray(meal.ingredients)
            ? meal.ingredients
            : []
          )
            .map((item) => text(item, 120))
            .filter(Boolean)
            .slice(0, 12),
          calories: number(meal.calories, 0, 2000),
          protein_g: number(meal.protein_g, 0, 250),
          carbs_g: number(meal.carbs_g, 0, 400),
          fat_g: number(meal.fat_g, 0, 200),
          prep_minutes: number(meal.prep_minutes, 0, 180),
        };
      });
    const totals = object(day.totals);
    return {
      day: text(day.day, 20) || `Dia ${dayIndex + 1}`,
      meals,
      totals: {
        calories: number(totals.calories, 0, 10000),
        protein_g: number(totals.protein_g, 0, 1000),
        carbs_g: number(totals.carbs_g, 0, 1500),
        fat_g: number(totals.fat_g, 0, 1000),
      },
    };
  });
  const targets = object(root.targets);
  const profile = object(root.profile_snapshot);
  const parsedProfile: NutritionProfile = {
    goal:
      profile.goal === "lose_fat" || profile.goal === "gain_muscle"
        ? profile.goal
        : "maintain",
    age: number(profile.age, 18, 90),
    height_cm: number(profile.height_cm, 120, 230),
    weight_kg: number(profile.weight_kg, 35, 300),
    activity_level:
      profile.activity_level === "low" || profile.activity_level === "high"
        ? profile.activity_level
        : "moderate",
    dietary_preference:
      typeof profile.dietary_preference === "string" &&
      Object.prototype.hasOwnProperty.call(
        DIET_LABELS,
        profile.dietary_preference,
      )
      ? (profile.dietary_preference as DietaryPreference)
      : "balanced",
    allergies: text(profile.allergies, 500),
    disliked_foods: text(profile.disliked_foods, 500),
    meals_per_day: number(profile.meals_per_day, 3, 6),
    water_target_ml: number(profile.water_target_ml, 1000, 6000),
  };
  return {
    id: Number(root.id),
    profile_snapshot: parsedProfile,
    targets: {
      calories_min: number(targets.calories_min, 1200, 4800),
      calories_max: number(targets.calories_max, 1200, 5000),
      protein_g: number(targets.protein_g, 0, 1000),
      carbs_g: number(targets.carbs_g, 0, 1500),
      fat_g: number(targets.fat_g, 0, 1000),
      water_ml: number(targets.water_ml, 1000, 6000),
    },
    days,
    shopping_list: rawShopping
      .map((rawItem) => {
        const item = object(rawItem);
        return {
          category: text(item.category, 80) || "Outros",
          name: text(item.name, 100),
          quantity: text(item.quantity, 80),
        };
      })
      .filter((item) => item.name && item.quantity)
      .slice(0, 120),
    created_at: text(root.created_at, 80),
    notes: (Array.isArray(root.notes) ? root.notes : [])
      .map((item) => text(item, 200))
      .filter(Boolean)
      .slice(0, 6),
  };
}

export function progressPercent(value: number, target: number) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0)
    return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
