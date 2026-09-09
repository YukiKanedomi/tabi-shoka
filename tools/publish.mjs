// 公開の1コマンド: 検査 → 暗号化ビルド → commit → push → GitHub Pages のビルド完了を待つ。
//   node tools/publish.mjs "コミットメッセージ"
//   node tools/publish.mjs "…" --no-build   … 旅データに変更がないとき
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const msg = args.find(a => !a.startsWith('--'));
if (!msg) { console.error('usage: node tools/publish.mjs "メッセージ" [--no-build]'); process.exit(1); }
const run = (cmd, a, opts = {}) => { const r = spawnSync(cmd, a, { cwd: ROOT, stdio: 'inherit', shell: false, ...opts }); if (r.status !== 0) { console.error(`✗ ${cmd} ${a.join(' ')}`); process.exit(r.status || 1); } };
const out = (cmd, a) => execFileSync(cmd, a, { cwd: ROOT }).toString().trim();

run(process.execPath, [path.join(ROOT, 'tools/check.mjs')]);
if (!args.includes('--no-build')) run(process.execPath, [path.join(ROOT, 'tools/build-data.mjs')]);
run('git', ['add', '-A']);
const staged = out('git', ['diff', '--cached', '--name-only']);
if (!staged) { console.log('変更がありません'); process.exit(0); }
run('git', ['commit', '-q', '-m', msg + '\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>']);
run('git', ['push', '-q', 'origin', 'main']);
const head = out('git', ['rev-parse', 'HEAD']);
console.log(`pushed ${head.slice(0, 7)}. Pages のビルドを待っています…`);
const t0 = Date.now();
while (Date.now() - t0 < 4 * 60 * 1000) {
  await new Promise(r => setTimeout(r, 15000));
  let st = '';
  try { st = out('gh', ['api', 'repos/YukiKanedomi/tabi-shoka/pages/builds/latest', '--jq', '.status + " " + .commit']); } catch {}
  if (st === `built ${head}`) { console.log(`✓ 公開されました（${Math.round((Date.now() - t0) / 1000)}秒）`); process.exit(0); }
  if (st.startsWith('errored')) { console.error('✗ Pages のビルドが失敗しました'); process.exit(1); }
}
console.error('Pages のビルドが 4 分待っても終わりません（空コミットで再トリガーしてください）'); process.exit(1);
