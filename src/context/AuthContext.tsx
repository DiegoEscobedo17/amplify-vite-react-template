import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { signIn, signUp, signOut, getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';

type UserShape = Pick<Schema['User']['type'], 'id' | 'email' | 'displayName' | 'role'>;

type AuthContextType = {
  user: UserShape | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

const STORAGE_KEY = 'app:user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserShape | null>(null);
  const [loading, setLoading] = useState(true);
  const client = useMemo(() => generateClient<Schema>(), []);

  useEffect(() => {
    (async () => {
      try {
        // Intenta recuperar la sesión actual de Cognito
        const current = await getCurrentUser();
        const attrs = await fetchUserAttributes();
        const emailAttr = attrs.email || '';
        const displayNameAttr = attrs.name || emailAttr;

        // Asegura perfil en tabla User
        const mutations: any = (client as any).mutations;
        const up = await mutations.upsertUserProfile({ sub: current.userId, email: emailAttr, displayName: displayNameAttr });
        const profile = up?.data;
        const u: UserShape = {
          id: profile?.id || current.userId,
          email: emailAttr,
          displayName: profile?.displayName || displayNameAttr || emailAttr,
          role: (profile?.role as any) || 'USER',
        };
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } catch {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    // Inicia sesión con Cognito
    await signIn({ username: email, password });
    // Carga atributos y asegura perfil
    const current = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const emailAttr = attrs.email || email;
    const displayNameAttr = attrs.name || emailAttr;
    const mutations: any = (client as any).mutations;
    const up = await mutations.upsertUserProfile({ sub: current.userId, email: emailAttr, displayName: displayNameAttr });
    const profile = up?.data;
    const u: UserShape = {
      id: profile?.id || current.userId,
      email: emailAttr,
      displayName: profile?.displayName || displayNameAttr || emailAttr,
      role: (profile?.role as any) || 'USER',
    };
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const register = async (email: string, password: string, displayName?: string) => {
    // Registro en Cognito
    await signUp({ username: email, password, options: { userAttributes: { email, name: displayName || email } } });
    // Intento de login inmediato (si requiere confirmación, esto fallará y se mostrará el error al usuario)
    await signIn({ username: email, password });
    // Carga atributos y asegura perfil
    const current = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const emailAttr = attrs.email || email;
    const displayNameAttr = attrs.name || displayName || emailAttr;
    const mutations: any = (client as any).mutations;
    const up = await mutations.upsertUserProfile({ sub: current.userId, email: emailAttr, displayName: displayNameAttr });
    const profile = up?.data;
    const u: UserShape = {
      id: profile?.id || current.userId,
      email: emailAttr,
      displayName: profile?.displayName || displayNameAttr || emailAttr,
      role: (profile?.role as any) || 'USER',
    };
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const logout = () => {
    signOut().finally(() => {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


