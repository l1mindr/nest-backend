import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class EmailService {
  abstract sendVerificationEmail(email: string, code: string): Promise<void>;

  abstract sendSuspensionEmail(
    email: string,
    displayName: string | null,
    reason: string,
    suspendedAt: Date
  ): Promise<void>;

  abstract sendUnsuspensionEmail(
    email: string,
    displayName: string | null,
    unsuspendedAt: Date
  ): Promise<void>;
}
