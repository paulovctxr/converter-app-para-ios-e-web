import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionDraft, parseNutritionDraft } from '../lib/nutrition-draft.ts';
import { DEFAULT_NUTRITION_PROFILE } from '../lib/nutrition.ts';

test('nutrition editing keeps empty strings and accepts Portuguese decimal values when saved', () => {
  const draft = nutritionDraft(DEFAULT_NUTRITION_PROFILE);
  draft.height_cm = '';
  assert.equal(draft.height_cm, '');
  assert.throws(() => parseNutritionDraft(draft), /Altura em cm/);
  draft.height_cm = '175';
  draft.weight_kg = '80,5';
  const saved = parseNutritionDraft(draft);
  assert.equal(saved.height_cm, 175);
  assert.equal(saved.weight_kg, 80.5);
  assert.equal(nutritionDraft(saved).weight_kg, '80.5');
});

test('profile save rejects impossible measures, missing fields and malformed numbers', () => {
  const draft = nutritionDraft(DEFAULT_NUTRITION_PROFILE);
  for (const height of ['07363', '0', ' ', '1e2', '175..5', '175,5.2']) {
    assert.throws(() => parseNutritionDraft({ ...draft, height_cm: height }), /Altura/);
  }
  assert.throws(() => parseNutritionDraft({ ...draft, age: '22.5' }), /Idade/);
  assert.throws(() => parseNutritionDraft({ ...draft, water_target_ml: '' }), /água/);
  assert.throws(() => parseNutritionDraft({ ...draft, meals_per_day: '0' }), /Refeições/);
});
