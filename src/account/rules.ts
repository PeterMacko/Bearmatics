// Form checks; the server checks the same rules again (worker/rules.ts).
export const BEARS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const validUsername = (value: string) => /^[A-Za-z0-9]{3,20}$/.test(value);
export const validPassword = (value: string) => [...value].length >= 8;
export const validEmail = (value: string) =>
  value.trim() === '' ||
  (value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
export const validNickname = (value: string) =>
  /^[\p{L}\p{N} ._-]{1,20}$/u.test(value.trim().replace(/\s+/g, ' '));
