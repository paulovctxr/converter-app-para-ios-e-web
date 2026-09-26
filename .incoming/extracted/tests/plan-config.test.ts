import { describe, expect, it } from 'vitest';
import { PIX_KEY, PLANS } from '../lib/plan-config';

describe('planos Summer Fit', () => {
  it('mantém o Premium essencial em cinco reais', () => {
    expect(PLANS.premium.price).toBe(5);
    expect(PLANS.premium.features).toContain('Contador de calorias');
  });

  it('oferece o Plus em oito reais com recursos adicionais', () => {
    expect(PLANS.plus.price).toBe(8);
    expect(PLANS.plus.features).toContain('Treinos próprios ilimitados');
    expect(PLANS.plus.features.length).toBeGreaterThan(PLANS.premium.features.length);
  });

  it('centraliza a chave PIX em um único ponto', () => {
    expect(PIX_KEY).toMatch(/^[-a-f0-9]{36}$/);
  });
});
