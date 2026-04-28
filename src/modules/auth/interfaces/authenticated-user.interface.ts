export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: {
    id: string;
    slug: string;
    name: string;
    permissions: string[];
  };
  passwordHash: string;
  isActive: boolean;
  twoFactorSecret: string | null;
}
