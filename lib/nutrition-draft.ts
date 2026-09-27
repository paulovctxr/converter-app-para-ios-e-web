import type { NutritionProfile } from './nutrition';

type NumericField = 'age' | 'height_cm' | 'weight_kg' | 'meals_per_day' | 'water_target_ml';
export type NutritionDraft = Omit<NutritionProfile, NumericField> & Record<NumericField, string>;

export function nutritionDraft(profile: NutritionProfile): NutritionDraft {
  return { ...profile, age: String(profile.age), height_cm: String(profile.height_cm),
    weight_kg: String(profile.weight_kg), meals_per_day: String(profile.meals_per_day),
    water_target_ml: String(profile.water_target_ml) };
}

export function parseNutritionDraft(draft: NutritionDraft): NutritionProfile {
  function field(key: NumericField, label: string, min: number, max: number, integer = false) {
    const raw = draft[key].trim().replace(',', '.');
    const value = Number(raw);
    if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`${label}: informe ${integer ? 'um número inteiro' : 'um valor'} entre ${min} e ${max}.`);
    }
    return value;
  }
  return { ...draft,
    age: field('age', 'Idade', 18, 90, true),
    height_cm: field('height_cm', 'Altura em cm', 120, 230),
    weight_kg: field('weight_kg', 'Peso em kg', 35, 300),
    meals_per_day: field('meals_per_day', 'Refeições por dia', 3, 6, true),
    water_target_ml: field('water_target_ml', 'Meta de água em ml', 1000, 6000, true),
  };
}
