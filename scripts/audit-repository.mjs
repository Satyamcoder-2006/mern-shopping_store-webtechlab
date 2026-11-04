import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const privateNames = /(^|\/)(node_modules|dist|build|coverage|uploads|tmp|output|shopping-app|\.aistudio|\.pytest_cache)(\/|$)|(^|\/)\.admin-|(^|\/)\.env($|\.)/;
const environment = Object.assign({}, ...readdirSync(root).filter(name => /^\.env(?:$|\.)/.test(name) && name !== '.env.example' && statSync(path.join(root, name)).isFile()).map(name => dotenv.parse(readFileSync(path.join(root, name)))));
const secrets = Object.entries(environment).filter(([key, value]) => /URI|SECRET|TOKEN|PASSWORD|KEY/.test(key) && value.length >= 16 && !value.includes('<') && !value.startsWith('replace-')).map(([, value]) => value);
const failures = [];
for (const file of files) {
  if (file !== '.env.example' && privateNames.test(file)) failures.push(`${file}: private/generated path`);
  const absolute = path.join(root, file);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) continue;
  if (statSync(absolute).size > 10 * 1024 * 1024) failures.push(`${file}: exceeds 10 MB`);
  if (/\.(webp|png|jpg|jpeg|ico)$/.test(file)) continue;
  const contents = readFileSync(absolute, 'utf8');
  if (secrets.some(value => contents.includes(value))) failures.push(`${file}: contains a local secret`);
  if (/mongodb(?:\+srv)?:\/\/[^\s/:<>`]+:[^@\s<>`]+@/.test(contents)) failures.push(`${file}: embedded database credentials`);
  if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(contents)) failures.push(`${file}: private key`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${files.length} repository files checked; no private paths, local secrets or oversized files found.`);
