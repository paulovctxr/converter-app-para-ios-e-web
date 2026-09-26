import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_NUTRITION_PROFILE,
  calculateNutritionTargets,
  nutritionTotals,
  progressPercent,
  readMealPlan,
} from '../lib/nutrition.ts'

test('nutrition targets stay conservative and respond to the selected goal', () => {
  const maintain = calculateNutritionTargets(DEFAULT_NUTRITION_PROFILE)
  const cut = calculateNutritionTargets({ ...DEFAULT_NUTRITION_PROFILE, goal: 'lose_fat' })
  const gain = calculateNutritionTargets({ ...DEFAULT_NUTRITION_PROFILE, goal: 'gain_muscle' })
  assert.ok(maintain.calories_min >= 1200)
  assert.ok(cut.calories_max < maintain.calories_max)
  assert.ok(gain.calories_min > maintain.calories_min)
  assert.equal(maintain.water_ml, 2500)
})

test('daily totals and progress use all logged macros without exceeding the UI scale', () => {
  const totals = nutritionTotals([
    { id: '1', label: 'Almoço', meal_type: 'lunch', calories: 500, protein_g: 35.2, carbs_g: 60, fat_g: 12.4 },
    { id: '2', label: 'Lanche', meal_type: 'snack', calories: 250, protein_g: 15, carbs_g: 30.5, fat_g: 7.6 },
  ])
  assert.deepEqual(totals, { calories: 750, protein_g: 50.2, carbs_g: 90.5, fat_g: 20 })
  assert.equal(progressPercent(750, 2000), 38)
  assert.equal(progressPercent(2500, 2000), 100)
  assert.equal(progressPercent(100, 0), 0)
})

test('meal plan reader requires seven days and bounds untrusted fields', () => {
  assert.equal(readMealPlan({ id: 1, days: [] }), null)
  const days = Array.from({ length: 7 }, (_, day) => ({
    day: `Dia ${day + 1}`,
    totals: { calories: 2000, protein_g: 130, carbs_g: 220, fat_g: 70 },
    meals: [{ id: `m${day}`, mealType: 'lunch', name: 'Prato', description: 'Simples', portion: '1 prato', ingredients: ['Arroz'], calories: 500, protein_g: 30, carbs_g: 60, fat_g: 12, prep_minutes: 20 }],
  }))
  const plan = readMealPlan({
    id: 8,
    profile_snapshot: DEFAULT_NUTRITION_PROFILE,
    targets: { calories_min: 1900, calories_max: 2100, protein_g: 130, carbs_g: 220, fat_g: 70, water_ml: 2500 },
    days,
    shopping_list: [{ category: 'Outros', name: 'Arroz', quantity: '1 kg' }],
    created_at: '2026-09-26T00:00:00Z',
  })
  assert.equal(plan.days.length, 7)
  assert.equal(plan.days[0].meals[0].name, 'Prato')
  assert.equal(plan.shopping_list[0].quantity, '1 kg')
})
