// Input rules used by the forms (src/account) and checked again by the server (worker/rules.ts).
// Pure checks only: no browser or Worker APIs, so both builds can import this file.
export { isRudeNickname } from './nicknameFilter';

export const BEAR_COUNT = 8;
const USERNAME = /^[A-Za-z0-9]{3,20}$/;
/** 32 bytes as lower-case hex: browser password keys and session tokens. */
const HEX_KEY = /^[0-9a-f]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
// Letters (any language), digits, spaces and . _ - ; 1-20 characters after trimming.
const NICKNAME = /^[\p{L}\p{N} ._-]{1,20}$/u;

export const validUsername = (value: string) => USERNAME.test(value);
export const validKey = (value: string) => HEX_KEY.test(value);

/** A nickname as it is stored: trimmed, inner spaces collapsed to one. */
export const tidyNickname = (value: string) => value.trim().replace(/\s+/g, ' ');
export const validNickname = (value: string) => NICKNAME.test(tidyNickname(value));

/** Optional email: empty (after trimming) is valid and means none. */
export const validEmail = (value: string) => {
  const trimmed = value.trim();
  return trimmed === '' || (trimmed.length <= EMAIL_MAX && EMAIL.test(trimmed));
};

export const validBear = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= BEAR_COUNT;
