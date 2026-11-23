// Form checks; the rules themselves are shared with the server (shared/rules.ts).
export { isRudeNickname, validEmail, validNickname, validUsername } from '../../shared/rules';
export const validPassword = (value: string) => [...value].length >= 8;
