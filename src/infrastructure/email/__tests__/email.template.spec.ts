import {
  buildPriceAlertEmail,
  buildSuspensionEmail,
  buildUnsuspensionEmail,
  buildVerificationEmail
} from '../email.template';

describe('email.template', () => {
  const projectName = 'NestJS Backend';
  const expiresAt = new Date('2024-01-01T12:34:00Z');

  describe('buildVerificationEmail', () => {
    const rendered = buildVerificationEmail({
      projectName,
      code: '123456',
      expiresInMinutes: 3
    });

    it('should include the project name in subject, html and text', () => {
      expect(rendered.subject).toContain(projectName);
      expect(rendered.html).toContain(projectName);
      expect(rendered.text).toContain(projectName);
    });

    it('should include the verification code', () => {
      expect(rendered.html).toContain('123456');
      expect(rendered.text).toContain('123456');
    });

    it('should state the relative expiry in minutes', () => {
      expect(rendered.html).toContain(
        'This verification code expires in 3 minutes.'
      );
      expect(rendered.text).toContain(
        'This verification code expires in 3 minutes.'
      );
    });

    it('should not mention UTC or an absolute timestamp', () => {
      expect(rendered.html).not.toContain('UTC');
      expect(rendered.text).not.toContain('UTC');
      expect(rendered.html).not.toContain('2024-01-01');
      expect(rendered.text).not.toContain('2024-01-01');
    });

    it('should use singular minutes for a one-minute TTL', () => {
      const oneMinute = buildVerificationEmail({
        projectName,
        code: '123456',
        expiresInMinutes: 1
      });

      expect(oneMinute.html).toContain('expires in 1 minute.');
      expect(oneMinute.text).toContain('expires in 1 minute.');
    });

    it('should include a security notice', () => {
      expect(rendered.html.toLowerCase()).toContain('single-use');
      expect(rendered.text.toLowerCase()).toContain('single-use');
    });

    it('should escape user-provided display names', () => {
      const withName = buildVerificationEmail({
        projectName,
        code: '123456',
        expiresInMinutes: 3,
        recipientName: '<script>alert(1)</script>'
      });

      expect(withName.html).not.toContain('<script>');
      expect(withName.html).toContain('&lt;script&gt;');
    });
  });

  describe('buildSuspensionEmail', () => {
    it('should include reason and suspension date', () => {
      const rendered = buildSuspensionEmail({
        projectName,
        displayName: 'John',
        reason: 'Terms of service violation',
        suspendedAt: expiresAt
      });

      expect(rendered.subject).toContain('suspended');
      expect(rendered.html).toContain('Terms of service violation');
      expect(rendered.html).toContain('2024-01-01 12:34 UTC');
      expect(rendered.text).toContain('Terms of service violation');
    });
  });

  describe('buildPriceAlertEmail', () => {
    const base = {
      projectName,
      coinName: 'Bitcoin',
      coinSymbol: 'btc',
      targetPrice: '100000.00000000',
      currentPrice: '101234.5',
      triggeredAt: expiresAt
    };

    it('should describe a SELL crossing as a rise to the current price', () => {
      const rendered = buildPriceAlertEmail({ ...base, direction: 'SELL' });

      expect(rendered.subject).toContain('BTC');
      expect(rendered.subject).toContain('risen to');
      expect(rendered.html).toContain('risen to');
      expect(rendered.html).toContain('at or above');
      expect(rendered.text).toContain('risen to');
    });

    it('should describe a BUY crossing as a fall to the current price', () => {
      const rendered = buildPriceAlertEmail({ ...base, direction: 'BUY' });

      expect(rendered.subject).toContain('fallen to');
      expect(rendered.html).toContain('at or below');
      expect(rendered.text).toContain('fallen to');
    });

    it('should drop the scale a numeric column carried and group the integer part', () => {
      const rendered = buildPriceAlertEmail({ ...base, direction: 'SELL' });

      expect(rendered.text).toContain('$100,000');
      expect(rendered.text).not.toContain('100000.00000000');
      expect(rendered.text).toContain('$101,234.5');
    });

    it('should report both prices and the detection time', () => {
      const rendered = buildPriceAlertEmail({ ...base, direction: 'SELL' });

      expect(rendered.text).toContain('Current price: $101,234.5');
      expect(rendered.text).toContain('Your target: $100,000');
      expect(rendered.text).toContain('2024-01-01 12:34 UTC');
      expect(rendered.html).toContain('2024-01-01 12:34 UTC');
    });

    it('should escape a coin name rather than render it as markup', () => {
      const rendered = buildPriceAlertEmail({
        ...base,
        direction: 'SELL',
        coinName: '<script>alert(1)</script>'
      });

      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;');
    });
  });

  describe('buildUnsuspensionEmail', () => {
    it('should include the unsuspension date', () => {
      const rendered = buildUnsuspensionEmail({
        projectName,
        displayName: 'John',
        unsuspendedAt: expiresAt
      });

      expect(rendered.subject).toContain('unsuspended');
      expect(rendered.html).toContain('2024-01-01 12:34 UTC');
      expect(rendered.text).toContain('2024-01-01 12:34 UTC');
    });
  });
});
