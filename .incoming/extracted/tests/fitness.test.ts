import { describe, expect, it } from 'vitest';
import { estimateBmr, isValidEnrollment } from '../lib/fitness';

describe('regras de fitness do Summer Treinos', () => {
  it('aceita matrículas numéricas com exatamente quatro dígitos, inclusive zero à esquerda', () => {
    expect(isValidEnrollment('0047')).toBe(true);
    expect(isValidEnrollment('9999')).toBe(true);
  });

  it('recusa formatos que não são quatro números', () => {
    expect(isValidEnrollment('123')).toBe(false);
    expect(isValidEnrollment('12345')).toBe(false);
    expect(isValidEnrollment('12A4')).toBe(false);
  });

  it('calcula uma estimativa basal determinística', () => {
    expect(estimateBmr(78, 178, 28)).toBe(1758);
  });
});
