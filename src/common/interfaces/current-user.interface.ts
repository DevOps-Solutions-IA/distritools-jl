export interface CurrentUser {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
}
