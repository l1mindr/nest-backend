import {
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
      expiresAt
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

    it('should include the expiration time in UTC', () => {
      expect(rendered.html).toContain('2024-01-01 12:34 UTC');
      expect(rendered.text).toContain('2024-01-01 12:34 UTC');
    });

    it('should include a security notice', () => {
      expect(rendered.html.toLowerCase()).toContain('single-use');
      expect(rendered.text.toLowerCase()).toContain('single-use');
    });

    it('should escape user-provided display names', () => {
      const withName = buildVerificationEmail({
        projectName,
        code: '123456',
        expiresAt,
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
