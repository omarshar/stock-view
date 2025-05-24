import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLanguage: (language: 'ar' | 'en') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  language: 'ar', // Default to Arabic
  theme: 'light',
  
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false 
  }),
  
  setIsLoading: (isLoading) => set({ isLoading }),
  
  setLanguage: (language) => set({ language }),
  
  setTheme: (theme) => set({ theme }),
  
  logout: () => set({ 
    user: null, 
    isAuthenticated: false 
  }),
}));
