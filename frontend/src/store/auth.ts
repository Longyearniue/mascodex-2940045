import { create } from 'zustand';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

interface User {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authAPI.login({ email, password });
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      
      // Get user info
      const userResponse = await authAPI.getCurrentUser();
      
      set({
        token: access_token,
        user: userResponse.data,
        isAuthenticated: true,
        isLoading: false,
      });
      
      toast.success('ログインしました');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.detail || 'ログインに失敗しました');
      throw error;
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await authAPI.register({ email, password });
      set({ isLoading: false });
      toast.success('アカウントを作成しました');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.detail || 'アカウント作成に失敗しました');
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    toast.success('ログアウトしました');
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    try {
      const response = await authAPI.getCurrentUser();
      set({
        user: response.data,
        isAuthenticated: true,
      });
    } catch (error) {
      localStorage.removeItem('token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },
}));