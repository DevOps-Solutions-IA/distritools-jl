import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error('Missing required environment variable: JWT_ACCESS_SECRET');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: 'distritoolsjl',
      audience: 'admin-api',
    });
  }

  validate(payload: CurrentUser): CurrentUser {
    return payload;
  }
}
