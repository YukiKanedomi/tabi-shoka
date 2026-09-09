// 公開前の検査: JS の構文、index.html と sw.js の版そろえ、private の秘密が公開ファイルに混ざっていないか。
//   node tools/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];

// 1. JS の構文
for (const f of [...fs.readdirSync(path.join(ROOT, 'js')).map(x => 'js/' + x), 'sw.js', ...fs.readdirSync(path.join(ROOT, 'tools')).filter(x => x.endsWith('.mjs')).map(x => 'tools/' + x)]) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); } catch (e) { fail.push(`${f}: 構文エラー\n${String(e.stderr || '').slice(0, 300)}`); }
}

// 2. index.html の ?v= と sw.js の SHELL の ?v= が同じか、SHELL に js/ の全ファイルが載っているか
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
for (const [name, re] of [['css', /app\.css\?v=(\w+)/], ['js', /app\.js\?v=(\w+)/]]) {
  const a = re.exec(html)?.[1], b = re.exec(sw)?.[1];
  if (!a || a !== b) fail.push(`${name} の版が index.html（${a}）と sw.js（${b}）で違います`);
}
for (const f of fs.readdirSync(path.join(ROOT, 'js'))) if (!sw.includes(`./js/${f}`)) fail.push(`sw.js の SHELL に js/${f} がありません`);

// 3. 秘密の混入（合言葉・Google キー・予約番号らしきもの）
let secrets = [];
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'private/config.json'), 'utf8'));
  if (cfg.passphrase) secrets.push(cfg.passphrase);
  if (cfg.gmapsKey) secrets.push(cfg.gmapsKey);
  if (cfg.gmapsKeyFile) { const m = /GMAPS_KEY\s*=\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(cfg.gmapsKeyFile, 'utf8')); if (m) secrets.push(m[1]); }
} catch {}
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
for (const f of tracked) {
  if (/\.(png|jpg|enc|ico)$/.test(f)) continue;
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const sec of secrets) if (sec && s.includes(sec)) fail.push(`${f} に秘密（${sec.slice(0, 4)}…）が含まれています`);
  if (/AIza[0-9A-Za-z_-]{30,}/.test(s)) fail.push(`${f} に Google API キーらしき文字列があります`);
}
for (const f of tracked) if (f.startsWith('private/')) fail.push(`${f} が git に入っています（private/ は公開しない）`);

if (fail.length) { console.error('NG\n- ' + fail.join('\n- ')); process.exit(1); }
console.log(`OK: js ${fs.readdirSync(path.join(ROOT, 'js')).length} files, versions aligned, no secrets in ${tracked.length} tracked files`);
