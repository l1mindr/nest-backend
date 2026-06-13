import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenService } from '../token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly tokenService: TokenService
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

  validate(_: Request, jwtPayload: IJwtPayload) {
    return this.tokenService.validatePayload(jwtPayload);
  }
}
