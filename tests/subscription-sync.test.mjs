import test from 'node:test'
import assert from 'node:assert/strict'
import { createSubscriptionSync } from '../lib/subscription-sync.ts'

const free = { is_admin: false, subscription_status: 'free', plan: 'basic', expires_at: null, server_time: 'initial' }
const pro = { ...free, subscription_status: 'pro', plan: 'premium', subscription_updated_at: 'approved' }

test('approval and expiry follow server state; clock-only changes and network errors preserve the UI', async () => {
  let result = free
  let fail = false
  const changes = []
  const sync = createSubscriptionSync(async () => {
    if (fail) throw new Error('offline')
    return result
  }, (next, previous) => changes.push([next, previous]))
  await sync.refresh()
  result = { ...free, server_time: 'later' }
  await sync.refresh()
  assert.equal(changes.length, 1)
  fail = true
  await sync.refresh()
  assert.equal(changes.length, 1)
  fail = false
  result = pro
  await sync.refresh()
  assert.equal(changes[1][0].subscription_status, 'pro')
  assert.equal(changes[1][1].subscription_status, 'free')
  result = { ...pro, subscription_status: 'expired', plan: 'basic' }
  await sync.refresh()
  assert.equal(changes[2][0].subscription_status, 'expired')
  sync.dispose()
})

test('overlapping checks are coalesced and late responses after logout cannot update access', async () => {
  let resolve
  let signal
  let calls = 0
  const changes = []
  const sync = createSubscriptionSync(async (currentSignal) => {
    calls++
    signal = currentSignal
    return new Promise(done => { resolve = done })
  }, access => changes.push(access))
  const first = sync.refresh()
  await sync.refresh()
  assert.equal(calls, 1)
  sync.dispose()
  assert.equal(signal.aborted, true)
  resolve(pro)
  await first
  await sync.refresh()
  assert.equal(changes.length, 0)
  assert.equal(calls, 1)
})
