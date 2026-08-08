/**
 * The serializable description of one email to deliver.
 *
 * This single contract is what the application publishes, what the queue
 * stores as a job payload and what the provider renders, so it has to survive
 * a JSON round trip unchanged: no entities, no request objects, and timestamps
 * carried as ISO 8601 strings rather than `Date` instances, which a round trip
 * would silently turn into strings anyway.
 *
 * `data` carries only what rendering the message needs. A verification code and
 * an invitation token are part of the rendered body and so have to travel with
 * the job; nothing else about the account does.
 */
export enum EmailMessageType {
  VERIFICATION = 'verification',
  ADMIN_INVITATION = 'admin-invitation',
  SUSPENSION = 'suspension',
  UNSUSPENSION = 'unsuspension'
}

interface EmailMessageOf<TType extends EmailMessageType, TData> {
  type: TType;
  /** Recipient address. */
  to: string;
  data: TData;
}

export type VerificationEmailMessage = EmailMessageOf<
  EmailMessageType.VERIFICATION,
  {
    code: string;
    expiresInMinutes: number;
  }
>;

export type AdminInvitationEmailMessage = EmailMessageOf<
  EmailMessageType.ADMIN_INVITATION,
  {
    token: string;
    expiresInHours: number;
  }
>;

export type SuspensionEmailMessage = EmailMessageOf<
  EmailMessageType.SUSPENSION,
  {
    displayName: string | null;
    reason: string;
    /** ISO 8601. */
    suspendedAt: string;
  }
>;

export type UnsuspensionEmailMessage = EmailMessageOf<
  EmailMessageType.UNSUSPENSION,
  {
    displayName: string | null;
    /** ISO 8601. */
    unsuspendedAt: string;
  }
>;

export type EmailMessage =
  | VerificationEmailMessage
  | AdminInvitationEmailMessage
  | SuspensionEmailMessage
  | UnsuspensionEmailMessage;
