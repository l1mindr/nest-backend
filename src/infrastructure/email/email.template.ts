export interface VerificationEmailData {
  projectName: string;
  code: string;
  expiresInMinutes: number;
  recipientName?: string | null;
}

export interface SuspensionEmailData {
  projectName: string;
  displayName: string | null;
  reason: string;
  suspendedAt: Date;
}

export interface UnsuspensionEmailData {
  projectName: string;
  displayName: string | null;
  unsuspendedAt: Date;
}

export interface AdminInvitationEmailData {
  projectName: string;
  token: string;
  expiresInHours: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char] as string
  );
}

function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  const datePart = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
  const timePart = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;

  return `${datePart} ${timePart} UTC`;
}

function greeting(name: string | null | undefined): string {
  return name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
}

function wrapHtml(body: string, projectName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(projectName)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#1d4ed8;padding:24px 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:20px;line-height:1.3;">${escapeHtml(
                  projectName
                )}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
                <p style="margin:0 0 4px;">You received this email because an action was requested on your
                ${escapeHtml(projectName)} account.</p>
                <p style="margin:0;">If you did not request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function buildVerificationEmail(
  data: VerificationEmailData
): RenderedEmail {
  const { projectName, code, expiresInMinutes } = data;
  const expiryLabel = `This verification code expires in ${expiresInMinutes} ${
    expiresInMinutes === 1 ? 'minute' : 'minutes'
  }.`;

  const html = wrapHtml(
    `
    <p style="margin:0 0 16px;font-size:16px;">${greeting(data.recipientName)}</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
      Use the verification code below to activate your account.
      <strong>${expiryLabel}</strong>
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <span style="display:inline-block;padding:16px 32px;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;font-family:monospace;font-size:32px;letter-spacing:8px;color:#1d4ed8;font-weight:bold;">${escapeHtml(
        code
      )}</span>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      For security, this code is single-use. If you did not create an account with
      ${escapeHtml(projectName)}, you can ignore this email.
    </p>
    `,
    projectName
  );

  const text = [
    `${projectName}`,
    '',
    `${greeting(data.recipientName)}`,
    '',
    `Use the verification code below to activate your account. ${expiryLabel}`,
    '',
    `Verification code: ${code}`,
    '',
    'For security, this code is single-use. If you did not create an account, you can ignore this email.',
    ''
  ].join('\n');

  return {
    subject: `Verify your ${projectName} email`,
    html,
    text
  };
}

/**
 * The invitation to become an administrator.
 *
 * The token is the whole credential, so the copy says plainly that it is
 * single-use and time-limited, and never names who was invited or by whom —
 * a misdirected email should disclose nothing about the administrator
 * population.
 */
export function buildAdminInvitationEmail(
  data: AdminInvitationEmailData
): RenderedEmail {
  const { projectName, token, expiresInHours } = data;
  const expiryLabel = `This invitation expires in ${expiresInHours} ${
    expiresInHours === 1 ? 'hour' : 'hours'
  }.`;

  const html = wrapHtml(
    `
    <p style="margin:0 0 16px;font-size:16px;">${greeting(null)}</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
      You have been invited to become an administrator of
      ${escapeHtml(projectName)}. Use the invitation token below to choose a
      username and password and finish setting up your account.
      <strong>${expiryLabel}</strong>
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <span style="display:inline-block;padding:16px 24px;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;font-family:monospace;font-size:16px;word-break:break-all;color:#1d4ed8;font-weight:bold;">${escapeHtml(
        token
      )}</span>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      This token can be used once and grants administrator access to
      ${escapeHtml(projectName)}. Do not forward this email. If you were not
      expecting an invitation, ignore it — no account is created until the
      invitation is accepted.
    </p>
    `,
    projectName
  );

  const text = [
    `${projectName}`,
    '',
    `${greeting(null)}`,
    '',
    `You have been invited to become an administrator of ${projectName}. Use the invitation token below to choose a username and password and finish setting up your account. ${expiryLabel}`,
    '',
    `Invitation token: ${token}`,
    '',
    'This token can be used once and grants administrator access. Do not forward this email. If you were not expecting an invitation, ignore it — no account is created until the invitation is accepted.',
    ''
  ].join('\n');

  return {
    subject: `You have been invited to administer ${projectName}`,
    html,
    text
  };
}

export function buildSuspensionEmail(data: SuspensionEmailData): RenderedEmail {
  const { projectName, reason, suspendedAt } = data;
  const suspendedOn = formatUtc(suspendedAt);
  const name = data.displayName ?? 'account';

  const html = wrapHtml(
    `
    <p style="margin:0 0 16px;font-size:16px;">${greeting(data.displayName)}</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
      Your ${escapeHtml(projectName)} account has been suspended on
      <strong>${suspendedOn}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
      Reason: <strong>${escapeHtml(reason)}</strong>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      If you believe this is a mistake, please contact our support team. Until the
      suspension is lifted, you will not be able to access your ${name}.
    </p>
    `,
    projectName
  );

  const text = [
    `${projectName}`,
    '',
    `${greeting(data.displayName)}`,
    '',
    `Your ${projectName} account has been suspended on ${suspendedOn}.`,
    '',
    `Reason: ${reason}`,
    '',
    'If you believe this is a mistake, please contact our support team.',
    ''
  ].join('\n');

  return {
    subject: `${projectName} account suspended`,
    html,
    text
  };
}

export function buildUnsuspensionEmail(
  data: UnsuspensionEmailData
): RenderedEmail {
  const { projectName, unsuspendedAt } = data;
  const unsuspendedOn = formatUtc(unsuspendedAt);

  const html = wrapHtml(
    `
    <p style="margin:0 0 16px;font-size:16px;">${greeting(data.displayName)}</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
      Good news! Your ${escapeHtml(projectName)} account has been unsuspended on
      <strong>${unsuspendedOn}</strong>.
    </p>
    <p style="margin:0;font-size:16px;line-height:1.6;">
      You can now sign in again with your usual credentials.
    </p>
    `,
    projectName
  );

  const text = [
    `${projectName}`,
    '',
    `${greeting(data.displayName)}`,
    '',
    `Good news! Your ${projectName} account has been unsuspended on ${unsuspendedOn}.`,
    '',
    'You can now sign in again with your usual credentials.',
    ''
  ].join('\n');

  return {
    subject: `${projectName} account unsuspended`,
    html,
    text
  };
}
