import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function passwordStrengthIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push('Password must be at least 10 characters long.');
  if (!/[a-z]/.test(password)) issues.push('Password must contain a lowercase letter.');
  if (!/[A-Z]/.test(password)) issues.push('Password must contain an uppercase letter.');
  if (!/[0-9]/.test(password)) issues.push('Password must contain a number.');
  return issues;
}
