import {
  ISessionRepository,
  SESSION_REPOSITORY
} from '@features/sessions/interfaces/sessions.interface';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { UserStatus } from '@features/users/enums/user-status.enum';
import {
  IUserQueryService,
  USER_QUERY_SERVICE
} from '@features/users/interfaces/users.interface';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Inject, Injectable } from '@nestjs/common';
import { TokenErrors } from '../../errors/token-errors';
import { IJwtPayload } from '../../interfaces/jwt-payload.interface';
import { ITokenValidationService } from '../../interfaces/token.interface';

@Injectable()
export class TokenValidationService implements ITokenValidationService {
  constructor(
    @Inject(USER_QUERY_SERVICE)
    private readonly userQueryService: IUserQueryService,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository
  ) {}

  async validate({ sub, sessionId }: IJwtPayload): Promise<CustomAuth> {
    const user = await this.userQueryService.findForTokenValidation(sub);

    if (!user) throw TokenErrors.invalidToken();

    if (user.status !== UserStatus.ACTIVATE) {
      throw TokenErrors.invalidToken();
    }

    const session = await this.sessionRepository.findActiveSession(
      sub,
      sessionId
    );

    if (!session) throw SessionErrors.sessionExpired(sessionId);

    return { user, session };
  }
}
