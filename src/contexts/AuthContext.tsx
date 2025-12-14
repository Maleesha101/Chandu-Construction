import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppRole } from '@/lib/types';
import { authApi, userApi, setAuthToken, getAuthToken } from '@/lib/apiClient';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: AppRole;
}

interface AuthContextType {
  user: User | null;
  userRole: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isRole: (role: AppRole | AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const userData = await userApi.getMe();
          setUser(userData);
          setUserRole(userData.role);
        } catch (error) {
          console.error('Failed to fetch user:', error);
          setAuthToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      setUserRole(response.user.role);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    try {
      const response = await authApi.register(email, password, fullName, role);
      setUser(response.user);
      setUserRole(response.user.role);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    authApi.logout();
    setUser(null);
    setUserRole(null);
  };

  const isRole = (role: AppRole | AppRole[]) => {
    if (!userRole) return false;
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      loading,
      signIn,
      signUp,
      signOut,
      isRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
