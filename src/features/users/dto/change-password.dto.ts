import { PasswordField } from '@infrastructure/http/validation/fields/password-field.decorator';

export class ChangePasswordDto {
  @PasswordField({
    description: 'The current password must meet security standards.',
    example: 'StrongPassword@1234'
  })
  readonly currentPassword: string;

  @PasswordField({
    description: 'The new password must also meet security standards.',
    example: 'NewStrongPassword@5678'
  })
  readonly newPassword: string;
}
