import { EmailField } from '@presentation/validation/fields/email-field.decorator';
import { VerificationCodeField } from '@presentation/validation/fields/verification-code-field.decorator';

export class VerifyEmailRequestDto {
  @EmailField()
  email: string;

  @VerificationCodeField()
  code: string;
}
