/**
 * Operator CLI for administrator accounts.
 *
 * There are no built-in or default administrator credentials. The first
 * administrator is created explicitly with this command:
 *
 *   npm run admin:create -- --email=ops@example.com --password=... --name="Ops Admin"
 *   npm run admin:promote -- --email=someone@example.com
 */
import { get, run, nowIso, newId, closeDb } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { hashPassword } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { displayNameSchema, emailSchema, passwordSchema } from '../lib/password.js';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function createAdmin() {
  const email = emailSchema.parse(arg('email'));
  const password = passwordSchema.parse(arg('password'));
  const displayName = displayNameSchema.parse(arg('name') ?? email.split('@')[0]);

  migrate();
  if (get('SELECT 1 FROM users WHERE email = ?', email)) {
    console.error('An account with that email already exists. Use `npm run admin:promote` instead.');
    process.exit(1);
  }

  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 20);
  let username = base.length >= 3 ? base : `admin_${base}`;
  let suffix = 1;
  while (get('SELECT 1 FROM users WHERE username = ?', username)) {
    username = `${base}_${suffix}`.slice(0, 24);
    suffix += 1;
  }

  const id = newId();
  const now = nowIso();
  run(
    `INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, email_verified_at,
                        bio, created_at, updated_at, last_active_at)
     VALUES (?,?,?,?,?, 'admin', 'active', ?, '', ?, ?, ?)`,
    id,
    email,
    username,
    displayName,
    hashPassword(password),
    now,
    now,
    now,
    now,
  );
  run('INSERT OR IGNORE INTO wallet_accounts (user_id, balance, updated_at) VALUES (?,0,?)', id, now);
  audit({
    actor: null,
    action: 'admin.account_created_via_cli',
    targetType: 'user',
    targetId: id,
    metadata: { email, username },
  });
  console.log(`Administrator created: ${email} (username: ${username})`);
}

function promote() {
  const email = emailSchema.parse(arg('email'));
  migrate();
  const row = get<{ id: string; username: string; role: string }>('SELECT id, username, role FROM users WHERE email = ?', email);
  if (!row) {
    console.error('No account found with that email. Register first, then promote.');
    process.exit(1);
  }
  if (row.role === 'admin') {
    console.log('That account is already an administrator.');
    return;
  }
  run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', 'admin', nowIso(), row.id);
  audit({
    actor: null,
    action: 'admin.role_changed',
    targetType: 'user',
    targetId: row.id,
    metadata: { from: row.role, to: 'admin', reason: 'promoted via operator CLI' },
  });
  console.log(`${row.username} is now an administrator.`);
}

const command = process.argv[2];
try {
  if (command === 'create') createAdmin();
  else if (command === 'promote') promote();
  else {
    console.log('Usage:');
    console.log('  npm run admin:create -- --email=ops@example.com --password=... --name="Ops Admin"');
    console.log('  npm run admin:promote -- --email=someone@example.com');
    process.exit(1);
  }
} finally {
  closeDb();
}
