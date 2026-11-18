// Form checks; the rules themselves are shared with the server (shared/rules.ts).
import { BEAR_COUNT } from '../../shared/rules';

export { isRudeNickname, validEmail, validNickname, validUsername } from '../../shared/rules';
export const BEARS = Array.from({ length: BEAR_COUNT }, (_, index) => index + 1);
export const validPassword = (value: string) => [...value].length >= 8;
