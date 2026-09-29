export type UserRole = 'vendas' | 'produtos';

export interface UserProfile {
  username: string;
  name: string;
  role: UserRole;
  roleLabel: string;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
}
