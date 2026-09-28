import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/index.js';
import { api } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (updated: Partial<User>) => Promise<void>;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setThemeState] = useState<'dark' | 'light'>((localStorage.getItem('theme') as any) || 'dark');
  const [accentColor, setAccentColorState] = useState<string>(localStorage.getItem('accentColor') || 'indigo');

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('accentColor', accentColor);
  }, [accentColor]);

  // Load current user from persistent token
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
        if (currentUser.theme) setThemeState(currentUser.theme as any);
        if (currentUser.accentColor) setAccentColorState(currentUser.accentColor);
      } catch (err) {
        console.warn('Session expired or invalid token');
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await api.auth.login({ email, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.user.theme) setThemeState(data.user.theme as any);
    if (data.user.accentColor) setAccentColorState(data.user.accentColor);
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await api.auth.register({ email, password, name });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    // Session token removal only. Database data is strictly preserved forever.
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = async (updated: Partial<User>) => {
    const res = await api.auth.updateProfile(updated);
    setUser(res);
  };

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    if (user) {
      api.auth.updateProfile({ theme: t }).catch(console.error);
    }
  };

  const setAccentColor = (c: string) => {
    setAccentColorState(c);
    if (user) {
      api.auth.updateProfile({ accentColor: c }).catch(console.error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        theme,
        setTheme,
        accentColor,
        setAccentColor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
