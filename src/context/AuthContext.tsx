import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types/auth';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (usernameInput: string, passwordInput: string) => { success: boolean; errorMessage?: string };
  logout: () => void;
  switchRole: (targetRole: UserRole) => void;
}

const USERS_DB: Record<string, { password: string; name: string; role: UserRole; roleLabel: string }> = {
  venda_edu: {
    password: '123',
    name: 'Eduardo (Operador de Caixa)',
    role: 'vendas',
    roleLabel: 'Registro de Vendas',
  },
  produto_edu: {
    password: '123456',
    name: 'Eduardo (Gestor de Estoque)',
    role: 'produtos',
    roleLabel: 'Cadastro de Produtos',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'supercaixa_user_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading auth state from storage', e);
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  const login = (usernameInput: string, passwordInput: string): { success: boolean; errorMessage?: string } => {
    const cleanUser = usernameInput.trim();
    const cleanKey = cleanUser.toLowerCase();

    // Check if user exists
    const account = USERS_DB[cleanKey];
    if (!account) {
      return {
        success: false,
        errorMessage: 'Usuário não encontrado. Utilize "Venda_Edu" ou "Produto_Edu".',
      };
    }

    // Check password
    if (account.password !== passwordInput) {
      // EXACT requirement from prompt:
      // "e caso a senha seja cadastrada incorretamemte exibir a mensagem "Senha Incorreta""
      return {
        success: false,
        errorMessage: 'Senha Incorreta',
      };
    }

    const loggedUser: UserProfile = {
      username: cleanUser,
      name: account.name,
      role: account.role,
      roleLabel: account.roleLabel,
    };

    setUser(loggedUser);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
  };

  const switchRole = (targetRole: UserRole) => {
    if (targetRole === 'vendas') {
      setUser({
        username: 'Venda_Edu',
        name: USERS_DB.venda_edu.name,
        role: 'vendas',
        roleLabel: USERS_DB.venda_edu.roleLabel,
      });
    } else {
      setUser({
        username: 'Produto_Edu',
        name: USERS_DB.produto_edu.name,
        role: 'produtos',
        roleLabel: USERS_DB.produto_edu.roleLabel,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
