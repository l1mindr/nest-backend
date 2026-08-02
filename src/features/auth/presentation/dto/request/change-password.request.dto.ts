import { PasswordField } from '@presentation/validation/fields/password-field.decorator';

export class ChangePasswordRequestDto {
  /**
   * Validated against the same rules as `newPassword`: a stored password that
   * no longer satisfies them cannot be re-entered here, and must be reset.
   */
  @PasswordField({
    description:
      'The password currently on the account. A mismatch returns `400 INVALID_CURRENT_PASSWORD`.'
  })
  currentPassword: string;

  @PasswordField({
    description:
      'Replacement password. Must differ from `currentPassword`, otherwise `400 PASSWORD_MUST_BE_DIFFERENT` is returned.'
  })
  newPassword: string;
}
