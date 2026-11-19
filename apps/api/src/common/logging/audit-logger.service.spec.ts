import { mockPinoLogger } from '../../../test/utils/mocks';
import { AuditLogger, maskEmail } from './audit-logger.service';

describe('maskEmail', () => {
  it.each([
    ['jane@example.com', 'j***@example.com'],
    ['@example.com', '***'],
    ['no-at-sign', '***'],
  ])('%s → %s', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });
});

describe('AuditLogger', () => {
  it('logs normal events at info with a filterable audit flag', () => {
    const logger = mockPinoLogger();
    new AuditLogger(logger).record({ event: 'signup', userId: 'u1' }, { ip: '1.2.3.4' });
    expect(logger.info).toHaveBeenCalledWith(
      { audit: true, event: 'signup', userId: 'u1', ip: '1.2.3.4' },
      'audit:signup',
    );
  });

  it('logs security-relevant events at warn and masks emails', () => {
    const logger = mockPinoLogger();
    new AuditLogger(logger).record(
      { event: 'signin_failed', email: 'jane@example.com', reason: 'wrong_password' },
      { ip: null },
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'j***@example.com', reason: 'wrong_password' }),
      'audit:signin_failed',
    );
  });
});
