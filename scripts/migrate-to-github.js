import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceDir = path.resolve(__dirname, '..');
const parentDir = path.resolve(sourceDir, '..');
const targetDir = path.join(parentDir, 'T-Reader');
const targetRepoUrl = 'https://github.com/NameHitherto/T-Reader';

console.log('=== Migrating to GitHub Repository ===');

// 1. Clone or Reset the Repo
if (!fs.existsSync(targetDir)) {
  console.log(`Cloning ${targetRepoUrl} to ${targetDir}...`);
  try {
    execSync(`git clone ${targetRepoUrl} "${targetDir}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed to clone. You may need to clone it manually or check your network/auth:`, e.message);
    process.exit(1);
  }
} else {
  console.log(`Target directory ${targetDir} already exists. Pulling latest changes...`);
  try {
    execSync(`git pull`, { cwd: targetDir, stdio: 'inherit' });
  } catch(e) {
    console.warn(`Failed to pull in target dir. Continuing anyway...`);
  }
}

// 2. Synchronize directories (Copy source to target, ignoring specific directories)
console.log(`Copying source files from ${sourceDir} to ${targetDir} ...`);

function copyDirectory(src, dest, ignoreList) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    if (ignoreList.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, ignoreList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const ignoreDirs = ['.git', 'node_modules', 'dist', 'target', '.vscode', '.idea'];
try {
  copyDirectory(sourceDir, targetDir, ignoreDirs);
  console.log('Files copied successfully.');
} catch (e) {
  console.error('Failed to copy files:', e.message);
  process.exit(1);
}

// 3. Commit and push
console.log('Committing and pushing to GitHub...');
try {
  execSync(`git add -A`, { cwd: targetDir, stdio: 'inherit' });
  const status = execSync(`git status --porcelain`, { cwd: targetDir, encoding: 'utf8' });
  if (status.trim() !== '') {
    execSync(`git commit -m "chore: migrate workflow & bump script"`, { cwd: targetDir, stdio: 'inherit' });
  }
  execSync(`git push origin main`, { cwd: targetDir, stdio: 'inherit' }); // Note: Default branch is assumed to be main, may need manual adjustment for develop/release

  console.log('Migration pushed to remote successfully.');
} catch (e) {
  console.error('Git push failed in target directory:', e.message);
  console.log('You might need to manually resolve branch issues or authenticate in the T-Reader directory.');
}
