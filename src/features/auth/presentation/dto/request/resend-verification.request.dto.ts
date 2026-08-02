import { EmailField } from '@presentation/validation/fields/email-field.decorator';

export class ResendVerificationRequestDto {
  @EmailField()
  email: string;
}
