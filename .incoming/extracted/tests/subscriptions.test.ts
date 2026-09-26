import { describe, expect, it } from 'vitest';
import { getNextMonthlyRenewal } from '../shared/subscriptions';

describe('renovação mensal', () => {
  it('mantém o mesmo dia no mês seguinte', () => {
    const result = getNextMonthlyRenewal(new Date('2026-09-26T10:00:00Z'));
    expect(result.toISOString()).toBe('2026-10-26T10:00:00.000Z');
  });

  it('ajusta o dia para o último dia em meses menores', () => {
    const result = getNextMonthlyRenewal(new Date('2026-01-31T10:00:00Z'));
    expect(result.toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });
});
