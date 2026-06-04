import { EmailField } from '@core/common/decorators/fields/email-field.decorator';
import { PasswordField } from '@core/common/decorators/fields/password-field.decorator';
import { UsernameField } from '@core/common/decorators/fields/username-field.decorator';

export class RegisterUserRequestDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @PasswordField()
  password: string;
}
