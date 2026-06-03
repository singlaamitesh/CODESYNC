import { create } from 'zustand';
import { pb, currentUser, type PbUser } from '@/shared/lib/pb';

export type AuthUser = PbUser;

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  accessToken: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const snapshot = () => ({
  user: currentUser(),
  isAuthenticated: pb.authStore.isValid,
  accessToken: pb.authStore.token || null,
});

export const useAuthStore = create<AuthState>((set) => {
  pb.authStore.onChange(() => set(snapshot()));

  return {
    ...snapshot(),

    async login(email, password) {
      await pb.collection('users').authWithPassword(email, password);
      set(snapshot());
    },

    async signup(email, password, name) {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        name,
      });
      await pb.collection('users').authWithPassword(email, password);
      set(snapshot());
    },

    logout() {
      pb.authStore.clear();
      set(snapshot());
    },

    async refresh() {
      if (!pb.authStore.isValid) return;
      try {
        await pb.collection('users').authRefresh();
      } catch {
        pb.authStore.clear();
      }
      set(snapshot());
    },
  };
});
