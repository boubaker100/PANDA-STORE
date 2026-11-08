// Creates the primary admin account securely.
// Secrets are read interactively or from .dev.vars, and NEVER printed or committed.
import { webcrypto } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { execSync } from 'node:child_process';
import { readVars, setVar } from './dev-vars.mjs';

const subtle = webcrypto.subtle;
const encoder = new TextEncoder();

const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password, iterations = 600_000) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  const saltHex = toHex(salt);
  const hashHex = toHex(derived);
  return `$pbkdf2-sha256$i=${iterations}$${saltHex}$${hashHex}`;
}

async function main() {
  const vars = readVars();
  let email = (process.env.ADMIN_INIT_EMAIL || vars.ADMIN_INIT_EMAIL)?.trim();
  let password = (process.env.ADMIN_INIT_PASSWORD || vars.ADMIN_INIT_PASSWORD)?.trim();

  const isRemote = process.argv.includes('--remote');
  const targetLabel = isRemote ? 'remote (الإنتاج)' : 'local (المحلي)';

  if (!email || !password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(`\n=== إعداد حساب المدير [${targetLabel}] ===`);
    if (!email) {
      email = (await rl.question('البريد الإلكتروني للمدير: ')).trim();
    }
    if (!password) {
      password = (await rl.question('كلمة المرور (12 حرفاً على الأقل): ')).trim();
    }
    rl.close();
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('خطأ: صيغة البريد الإلكتروني غير صحيحة.');
    process.exit(1);
  }

  if (!password || password.length < 12) {
    console.error('خطأ: كلمة المرور ضعيفة. يجب ألا تقل عن 12 حرفاً.');
    process.exit(1);
  }

  console.log(`جارٍ تشفير كلمة المرور (PBKDF2-HMAC-SHA256 مع 600,000 تكرار)...`);
  const t0 = performance.now();
  const passwordHash = await hashPassword(password, 600_000);
  const dt = performance.now() - t0;
  console.log(`تم التشفير في ${dt.toFixed(1)}ms.`);

  const normEmail = email.toLowerCase();

  // Escape single quotes for SQL literal
  const safeEmail = normEmail.replace(/'/g, "''");
  const safeHash = passwordHash.replace(/'/g, "''");

  const sql = `INSERT INTO admins (email, password_hash, token_version, created_at, updated_at) VALUES ('${safeEmail}', '${safeHash}', 1, unixepoch(), unixepoch()) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, token_version = token_version + 1, updated_at = unixepoch();`;

  const flag = isRemote ? '--remote' : '--local';
  console.log(`جارٍ تسجيل الحساب في قاعدة بيانات D1 (${targetLabel})...`);

  try {
    execSync(`npx wrangler d1 execute DB ${flag} --command="${sql}"`, {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    console.log(`✅ تم إنشاء/تحديث حساب المدير بنجاح: ${normEmail}`);
  } catch (err) {
    console.error('تعذّر تنفيذ أمر قاعدة البيانات:', err.message);
    process.exit(1);
  }

  // Clean up any temporary init vars from .dev.vars if they existed
  if (vars.ADMIN_INIT_EMAIL || vars.ADMIN_INIT_PASSWORD) {
    setVar('ADMIN_INIT_EMAIL', '');
    setVar('ADMIN_INIT_PASSWORD', '');
    console.log('تم تنظيف متغيرات التهيئة المؤقتة من .dev.vars تلقائياً.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('create-admin.mjs')) {
  main().catch((err) => {
    console.error('خطأ:', err);
    process.exit(1);
  });
}
