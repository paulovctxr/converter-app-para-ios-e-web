import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PLAN_CONFIG,
  effectiveStatus,
  isProAccess,
  monthlyPrice,
} from '../lib/plans.ts'

test('plan helpers keep free and PRO access explicit', () => {
  assert.equal(isProAccess(null), false)
  assert.equal(isProAccess({
    is_admin: false,
    subscription_status: 'pro',
    subscription_plan: 'monthly',
    plan: 'plus',
    expires_at: '2099-01-01T00:00:00Z',
    server_time: '2026-01-01T00:00:00Z',
  }), true)
  assert.equal(isProAccess({
    is_admin: true,
    subscription_status: 'free',
    subscription_plan: null,
    plan: 'basic',
    expires_at: null,
    server_time: '2026-01-01T00:00:00Z',
  }), true)
  assert.equal(effectiveStatus({
    is_admin: false,
    subscription_status: 'expired',
    subscription_plan: 'annual',
    plan: 'basic',
    expires_at: '2025-01-01T00:00:00Z',
    server_time: '2026-01-01T00:00:00Z',
  }), 'expired')
})

test('central pricing supports a future promotion without changing screens', () => {
  assert.equal(monthlyPrice(DEFAULT_PLAN_CONFIG), 1000)
  assert.equal(monthlyPrice({
    ...DEFAULT_PLAN_CONFIG,
    promotion_active: true,
  }), 1000)
  assert.equal(
    DEFAULT_PLAN_CONFIG.pro_monthly_price_cents * 12 -
      DEFAULT_PLAN_CONFIG.pro_annual_price_cents,
    DEFAULT_PLAN_CONFIG.annual_savings_cents,
  )
  assert.equal(DEFAULT_PLAN_CONFIG.nutrition_generation_limit, 4)
})
