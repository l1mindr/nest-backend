import { EmailField } from '@infrastructure/http/validation/fields/email-field.decorator';
import { PasswordField } from '@infrastructure/http/validation/fields/password-field.decorator';
import { UsernameField } from '@infrastructure/http/validation/fields/username-field.decorator';

export class RegisterUserRequestDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @PasswordField()
  password: string;
}
