import { PasswordField } from '@infrastructure/http/validation/fields/password-field.decorator';

export class ChangePasswordRequestDto {
  @PasswordField({
    description: 'Current account password'
  })
  currentPassword: string;

  @PasswordField({
    description: 'New account password'
  })
  newPassword: string;
}
