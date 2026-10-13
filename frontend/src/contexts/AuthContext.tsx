import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi, setAuthToken } from '../services/api';

export interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const data = await fetchApi('/api/v2/auth/me');
      setUser(data);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    
    const handleUnauthorized = () => {
      setAuthToken(null);
      setUser(null);
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await fetchApi('/api/v2/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data?.access_token) {
      setAuthToken(data.access_token);
    }
    
    if (data?.user) {
      setUser(data.user);
    } else {
      await checkAuth();
    }
  };

  const register = async (email: string, password: string) => {
    const data = await fetchApi('/api/v2/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data?.access_token) {
      setAuthToken(data.access_token);
    }
    
    // Automatically log in after registration
    await login(email, password);
  };

  const logout = async () => {
    try {
      await fetchApi('/api/v2/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    }
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
