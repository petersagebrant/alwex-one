import { randomBytes, webcrypto } from "node:crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?";
const ALL = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

const DEFAULT_LENGTH = 16;
const MIN_LENGTH = 12;

function fillRandom(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof webcrypto.getRandomValues === "function") {
    return webcrypto.getRandomValues(bytes);
  }
  bytes.set(randomBytes(length));
  return bytes;
}

function pick(alphabet: string, byte: number): string {
  return alphabet[byte % alphabet.length] ?? alphabet[0]!;
}

/** Cryptographically random temporary password. Never persist the result. */
export function generateTemporaryPassword(length = DEFAULT_LENGTH): string {
  if (length < MIN_LENGTH) {
    throw new Error("Tillfälligt lösenord måste vara minst 12 tecken.");
  }

  const bytes = fillRandom(length);
  const chars = [
    pick(UPPER, bytes[0]!),
    pick(LOWER, bytes[1]!),
    pick(DIGITS, bytes[2]!),
    pick(SYMBOLS, bytes[3]!),
  ];

  for (let i = 4; i < length; i += 1) {
    chars.push(pick(ALL, bytes[i]!));
  }

  const shuffle = fillRandom(length);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = shuffle[i]! % (i + 1);
    const current = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = current;
  }

  return chars.join("");
}
