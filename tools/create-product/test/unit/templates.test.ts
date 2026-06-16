import { toKebabCase, toPascalCase } from '../../src/templates';

describe('template utilities', () => {
  test('toKebabCase converts PascalCase and snake_case', () => {
    expect(toKebabCase('PostgreSQL')).toBe('postgre-sql');
    expect(toKebabCase('my_product')).toBe('my-product');
    expect(toKebabCase('redisCache')).toBe('redis-cache');
  });

  test('toPascalCase converts kebab-case and snake_case', () => {
    expect(toPascalCase('postgresql')).toBe('Postgresql');
    expect(toPascalCase('my-product')).toBe('MyProduct');
    expect(toPascalCase('my_product')).toBe('MyProduct');
  });
});
