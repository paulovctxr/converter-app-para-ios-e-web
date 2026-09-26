import test from 'node:test'
import assert from 'node:assert/strict'
import { readFitness, weekSummary, safeRedirectPath, MAX_SESSIONS } from '../lib/fitness.ts'

test('rejects external and protocol-relative auth redirects', () => {
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', null]) assert.equal(safeRedirectPath(path), '/')
  assert.equal(safeRedirectPath('/auth/reset-password'), '/auth/reset-password')
  assert.equal(safeRedirectPath('/?tab=treinos'), '/?tab=treinos')
})
test('new accounts start with no fabricated progress', () => {
  const data = readFitness(null)
  assert.deepEqual(data.workouts, [])
  assert.deepEqual(weekSummary(data.sessions).counts, [0, 0, 0, 0, 0, 0, 0])
})
test('weekly totals use Monday through Sunday including year boundaries', () => {
  const make = (day, minutes) => ({ id: day, workoutId: 'a', title: 'A', completedAt: new Date(day).toISOString(), minutes })
  const result = weekSummary([make('2025-12-28T12:00:00', 99), make('2025-12-29T12:00:00', 30), make('2026-01-01T12:00:00', 40), make('2026-01-04T12:00:00', 20), make('2026-01-05T12:00:00', 99)], new Date('2026-01-01T15:00:00'))
  assert.equal(result.count, 3); assert.equal(result.minutes, 90)
  assert.deepEqual(result.counts, [1, 0, 0, 1, 0, 0, 1])
})
test('malformed metadata is bounded and invalid history is excluded', () => {
  const data = readFitness({ goal: Infinity, workouts: [null, { id: 'a', title: ' A ', minutes: -1, exercises: [null, { name: 'Agachamento', sets: 99 }] }], sessions: [{ id: 'bad', completedAt: 'invalid' }] })
  assert.equal(data.goal, 3); assert.equal(data.workouts[0].title, 'A'); assert.equal(data.workouts[0].minutes, 1)
  assert.equal(data.workouts[0].exercises[0].sets, 20); assert.equal(data.sessions.length, 0)
})
test('keeps valid imported load details and removes malformed optional fields', () => {
  const data = readFitness({ workouts: [{ id: 'a', title: 'A', exercises: [
    { id: '1', name: 'Supino', sets: 4, reps: '10', weight: 32.55, weightUnit: 'kg', restSeconds: 90, notes: ' Cadência controlada ' },
    { id: '2', name: 'Crucifixo', sets: 3, reps: '12', weight: -2, weightUnit: 'kg', restSeconds: Infinity },
  ] }] })
  assert.deepEqual(data.workouts[0].exercises[0], { id: '1', name: 'Supino', sets: 4, reps: '10', weight: 32.6, weightUnit: 'kg', restSeconds: 90, notes: 'Cadência controlada' })
  assert.deepEqual(data.workouts[0].exercises[1], { id: '2', name: 'Crucifixo', sets: 3, reps: '12' })
})
test('retains only the latest bounded session history', () => {
  const sessions = Array.from({ length: MAX_SESSIONS + 2 }, (_, id) => ({ id: String(id), workoutId: 'a', title: 'A', completedAt: new Date().toISOString(), minutes: 20 }))
  const data = readFitness({ sessions }); assert.equal(data.sessions.length, MAX_SESSIONS); assert.equal(data.sessions[0].id, '2')
})
