import { mockConfig } from '../../test/utils/mocks';

describe('AppConfig', () => {
  it('returns typed values and knows when it runs in production', () => {
    expect(mockConfig().get('PORT')).toBe(3000);
    expect(mockConfig().isProduction).toBe(false);
    expect(mockConfig({ NODE_ENV: 'production' }).isProduction).toBe(true);
  });
});
