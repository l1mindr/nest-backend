import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from '@features/auth/auth.service';
import jwtConfig from '@features/auth/config/jwt.config';
import { JwtPayload } from '@features/auth/interfaces/jwt-payload.interface';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          return req.cookies['access_token'] || null;
        }
      ]),
      secretOrKey: jwtConfiguration.secret,
      passReqToCallback: true
    });
  }

  validate(req: Request, jwtPayload: JwtPayload) {
    return this.authService.validateUserJwt(jwtPayload);
  }
}
