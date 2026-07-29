import { EmailField } from '@presentation/validation/fields/email-field.decorator';
import { PasswordField } from '@presentation/validation/fields/password-field.decorator';
import { UsernameField } from '@presentation/validation/fields/username-field.decorator';

export class RegisterUserRequestDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @PasswordField()
  password: string;
}
