const FINANCE_PIN_HASH_KEY = 'helatte_finance_pin_hash';

export const getFinancePinHash = () => localStorage.getItem(FINANCE_PIN_HASH_KEY);

export const setFinancePinHash = (hash: string) => {
  localStorage.setItem(FINANCE_PIN_HASH_KEY, hash);
};

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateFinancePin(pin: string) {
  const storedHash = getFinancePinHash();
  if (!storedHash) return false;

  const hash = await hashPin(pin);
  return hash === storedHash;
}
