import PocketBase from 'pocketbase';

// In production, Caddy proxies /pb/* to the PocketBase container so we hit the
// same origin. In development the dev server runs on 8080 and PocketBase on 8090.
const PB_URL =
  import.meta.env.VITE_PB_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : '/pb');

export const pb = new PocketBase(PB_URL);

// On boot, validate the persisted token by hitting auth-refresh. If the user
// no longer exists (e.g., DB was reset) we clear the stale credentials so
// the UI shows the login screen instead of a broken authed state.
if (pb.authStore.isValid) {
  pb.collection('users').authRefresh().catch(() => {
    console.warn('[pb] stale auth token cleared');
    pb.authStore.clear();
  });
}

pb.authStore.onChange(() => {
  // no-op hook; consumers subscribe via useAuthStore.
});

export interface PbUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export function currentUser(): PbUser | null {
  const rec = pb.authStore.record as any;
  if (!rec || !pb.authStore.isValid) return null;
  return {
    id: rec.id,
    email: rec.email,
    name: rec.name || rec.email,
    avatar: rec.avatar || '',
  };
}
