import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepository,
} from 'src/modules/auth/domain/repositories/auth-session.repository';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(sessionId: string, userId: string): Promise<void> {
    await this.authSessionRepository.revoke(sessionId);
    await this.auditRepository.write({
      actorUserId: userId,
      action: 'auth.logout',
      entityType: 'auth_session',
      entityId: sessionId,
    });
  }
}
