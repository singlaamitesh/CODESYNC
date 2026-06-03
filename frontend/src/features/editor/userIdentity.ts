/**
 * Per-browser collaborative user identity.
 *
 * Each browser gets a stable id / name / color persisted in localStorage so a
 * returning user keeps the same presence in the Y.js awareness protocol.
 */

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
  cursor?: { line: number; column: number };
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
];

/** Pick a random presence color from the palette. */
export const generateUserColor = (): string =>
  COLORS[Math.floor(Math.random() * COLORS.length)];

/**
 * Get (or lazily create + persist) this browser's collaborative identity.
 * Returns a stable userId, a friendly generated userName, and a color.
 */
export const getUserIdentity = () => {
  let userId = localStorage.getItem('codesync-user-id');
  let userName = localStorage.getItem('codesync-user-name');
  let userColor = localStorage.getItem('codesync-user-color');

  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('codesync-user-id', userId);
  }

  if (!userName) {
    const adjectives = ['Swift', 'Clever', 'Bright', 'Quick', 'Sharp'];
    const nouns = ['Coder', 'Dev', 'Hacker', 'Builder', 'Creator'];
    const a = adjectives[Math.floor(Math.random() * adjectives.length)];
    const n = nouns[Math.floor(Math.random() * nouns.length)];
    userName = `${a}${n}${Math.floor(Math.random() * 100)}`;
    localStorage.setItem('codesync-user-name', userName);
  }

  if (!userColor) {
    userColor = generateUserColor();
    localStorage.setItem('codesync-user-color', userColor);
  }

  return { userId, userName, userColor };
};
