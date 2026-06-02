import { PasswordField } from '@core/common/decorators/fields/password-field.decorator';

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
