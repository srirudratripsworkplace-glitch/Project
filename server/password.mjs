import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const saltBytes = 16;
const keyBytes = 64;
const maxMemory = 64 * 1024 * 1024;
const passwordHashPattern = /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/i;

export function isValidAdminPasswordHash(passwordHash) {
  return typeof passwordHash === 'string' && passwordHashPattern.test(passwordHash);
}

export async function hashAdminPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) {
    throw new Error('The admin password must be between 14 and 256 characters.');
  }

  const salt = randomBytes(saltBytes);
  const derivedKey = await scrypt(password, salt, keyBytes, {
    N: scryptCost,
    r: scryptBlockSize,
    p: scryptParallelization,
    maxmem: maxMemory,
  });
  return `scrypt$${scryptCost}$${scryptBlockSize}$${scryptParallelization}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyAdminPassword(password, passwordHash) {
  if (typeof password !== 'string' || password.length > 256 || !isValidAdminPasswordHash(passwordHash)) {
    return false;
  }

  const [, , , , saltHex, expectedKeyHex] = passwordHash.split('$');
  const actualKey = await scrypt(password, Buffer.from(saltHex, 'hex'), keyBytes, {
    N: scryptCost,
    r: scryptBlockSize,
    p: scryptParallelization,
    maxmem: maxMemory,
  });
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');
  return timingSafeEqual(actualKey, expectedKey);
}
