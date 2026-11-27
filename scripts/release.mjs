import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: rootDir, stdio: 'inherit' });
}

function main() {
  const args = process.argv.slice(2);
  const version = args.find((a) => !a.startsWith('-'));
  const shouldPush = args.includes('--push');

  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('用法: npm run release -- <x.y.z> [--push]');
    console.error('示例: npm run release -- 0.2.0 --push');
    process.exit(1);
  }

  // 1. 更新 package.json
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  // 2. 更新 src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8');

  // 3. 更新 src-tauri/Cargo.toml（仅替换 [package] 首处的 version）
  const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  const updatedCargoToml = cargoToml.replace(
    /^(version\s*=\s*")([^"]+)(")/m,
    `$1${version}$3`,
  );
  if (updatedCargoToml === cargoToml) {
    throw new Error('未能在 src-tauri/Cargo.toml 中找到 version 字段');
  }
  fs.writeFileSync(cargoTomlPath, updatedCargoToml, 'utf8');

  console.log(`已同步更新版本号至 v${version}：`);
  console.log('  - package.json');
  console.log('  - src-tauri/tauri.conf.json');
  console.log('  - src-tauri/Cargo.toml');

  if (!shouldPush) {
    console.log('\n下一步可执行以下命令提交并触发 GitHub Releases 自动打包：');
    console.log(`  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
    console.log(`  git commit -m "chore(release): 发布 v${version}"`);
    console.log(`  git tag -a v${version} -m "ShowWorker v${version}"`);
    console.log(`  git push origin main --tags`);
    return;
  }

  run('git', ['add', 'package.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml']);
  run('git', ['commit', '-m', `chore(release): 发布 v${version}`]);
  run('git', ['tag', '-a', `v${version}`, '-m', `ShowWorker v${version}`]);
  run('git', ['push', 'origin', 'main', `v${version}`]);
  console.log(`\n已推送 v${version}，GitHub Actions 正在自动打包并发布安装包！`);
}

main();
