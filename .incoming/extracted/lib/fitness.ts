export function isValidEnrollment(value: string) {
  return /^[0-9]{4}$/.test(value);
}

export function estimateBmr(weightKg: number, heightCm: number, age: number) {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
}
