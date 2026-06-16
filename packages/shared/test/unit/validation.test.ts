import { isValidProfile, assertValidProfile } from '../../src/validation';

describe('shared validation', () => {
  test('isValidProfile accepts valid profiles', () => {
    expect(isValidProfile('development')).toBe(true);
    expect(isValidProfile('production')).toBe(true);
    expect(isValidProfile('staging')).toBe(true);
    expect(isValidProfile('invalid')).toBe(false);
  });

  test('assertValidProfile throws on invalid profile', () => {
    expect(() => assertValidProfile('invalid')).toThrow();
  });
});
