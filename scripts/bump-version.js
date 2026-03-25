import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = process.argv[2];
if (!version) {
  console.error('Please specify a version, e.g. npm run release 0.4.0');
  process.exit(1);
}

const cleanVersion = version.replace(/^v/, '');
console.log(`Bumping version to ${cleanVersion}...`);

function updateVersions(cleanVersion) {
  console.log(`Updating version in config files...`);
  
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = cleanVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Updated package.json');

  const tauriConfPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = cleanVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log('Updated tauri.conf.json');

  const cargoTomlPath = path.join(__dirname, '../src-tauri/Cargo.toml');
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/version\s*=\s*".*?"/, `version = "${cleanVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log('Updated Cargo.toml');
}

function syncLocks() {
  console.log('Syncing lock files and dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    execSync('cargo update --workspace', { cwd: path.join(__dirname, '../src-tauri'), stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to sync locks:', e);
    process.exit(1);
  }
}

// 1. Develop branch process
function processDevelop() {
  try {
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (currentBranch !== 'develop') {
      console.warn(`Warning: Expected to be on 'develop' branch, currently on '${currentBranch}'. Switching to develop...`);
      execSync('git checkout develop', { stdio: 'inherit' });
    }
  } catch(e) { /* ignore */ }

  console.log('=== Processing Develop Branch ===');
  updateVersions(cleanVersion);
  syncLocks();
  
  console.log('Committing and pushing all changes to develop...');
  try {
    execSync('git add -A', { stdio: 'inherit' });
    // Check if there's anything to commit
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim() !== '') {
      execSync(`git commit -m "chore: bump version to v${cleanVersion}"`, { stdio: 'inherit' });
    }
    execSync('git push origin develop', { stdio: 'inherit' });
  } catch(e) {
    console.error('Git action failed on develop:', e.message);
    process.exit(1);
  }
}

// 2. Release branch process
function processRelease() {
  console.log('=== Processing Release Branch ===');
  try {
    execSync('git checkout release', { stdio: 'inherit' });
  } catch(e) {
    console.error('Failed to checkout release branch:', e.message);
    process.exit(1);
  }

  updateVersions(cleanVersion);
  syncLocks();

  const releaseNotesPath = path.join(__dirname, '../RELEASE_NOTES.md');
  let releaseBody = '';

  // 直接从 RELEASE_NOTES.md 读取内容作为发布说明
  if (fs.existsSync(releaseNotesPath)) {
    releaseBody = fs.readFileSync(releaseNotesPath, 'utf8').trim();
  }

  if (!releaseBody) {
    releaseBody = `Update to v${cleanVersion}`;
  }

  console.log('Release body loaded from RELEASE_NOTES.md for Github Actions.');

  console.log('Committing, tagging, and pushing release branch...');
  try {
    execSync('git add -A', { stdio: 'inherit' });
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim() !== '') {
      execSync(`git commit -m "release: v${cleanVersion}"`, { stdio: 'inherit' });
    }
    execSync(`git tag v${cleanVersion}`, { stdio: 'inherit' });
    
    execSync('git push origin release', { stdio: 'inherit' });
    execSync(`git push origin v${cleanVersion}`, { stdio: 'inherit' });
    
    console.log(`Successfully bumped, committed, and pushed v${cleanVersion} on release branch!`);
  } catch(e) {
    console.error('Git action failed on release:', e.message);
    process.exit(1);
  }
}

processDevelop();
processRelease();

