import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWorkoutImport, validateWorkoutImport, workoutImportToFitness } from '../lib/workout-import.ts'

test('normalizes AI data, preserves order and removes exact photo overlap', () => {
  const analysis = normalizeWorkoutImport({ quality: 'good', qualityIssues: [], workouts: [{
    name: ' Treino A ', focus: ' Peito ', exercises: [
      { name: 'Supino reto', sets: 4, repetitions: '10', weight: 30, weightUnit: 'kg', restSeconds: 90, notes: null, confidence: 'high', needsReview: false },
      { name: 'Supino reto', sets: 4, repetitions: '10', weight: 30, weightUnit: 'kg', restSeconds: 90, notes: null, confidence: 'high', needsReview: false },
      { name: 'Crucifixo', sets: 3, repetitions: '12', weight: null, weightUnit: null, restSeconds: null, notes: 'controle', confidence: 'medium', needsReview: false },
    ],
  }] })
  assert.equal(analysis.quality, 'good')
  assert.equal(analysis.workouts[0].name, 'Treino A')
  assert.equal(analysis.workouts[0].exercises.length, 2)
  assert.deepEqual(validateWorkoutImport(analysis, 1), [])
  const workouts = workoutImportToFitness(analysis)
  assert.equal(workouts[0].exercises[0].weight, 30)
  assert.equal(workouts[0].exercises[0].restSeconds, 90)
  assert.equal(workouts[0].exercises[1].notes, 'controle')
})

test('never treats unreadable fields as valid invented data', () => {
  const analysis = normalizeWorkoutImport({ quality: 'low', qualityIssues: ['Imagem tremida'], workouts: [{ name: '', exercises: [{ name: '', sets: null, repetitions: null, confidence: 'low', needsReview: true }] }] })
  assert.equal(analysis.quality, 'low')
  assert.equal(analysis.workouts[0].exercises[0].name, 'Não identificado')
  assert.equal(analysis.workouts[0].exercises[0].sets, null)
  assert.ok(validateWorkoutImport(analysis).length >= 2)
  assert.throws(() => workoutImportToFitness(analysis), /nome do exercício/i)
})

test('blocks saving more imported workout blocks than available slots', () => {
  const analysis = normalizeWorkoutImport({ quality: 'good', workouts: [
    { name: 'A', exercises: [{ name: 'Agachamento', sets: 4, repetitions: '8', confidence: 'high' }] },
    { name: 'B', exercises: [{ name: 'Remada', sets: 3, repetitions: '12', confidence: 'high' }] },
  ] })
  assert.match(validateWorkoutImport(analysis, 1)[0], /espaço para apenas 1/i)
})
