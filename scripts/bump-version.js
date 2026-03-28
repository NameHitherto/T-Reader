import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const RELEASE_BRANCH = 'release'

const versionArg = process.argv[2]
if (!versionArg) {
  console.error('Please specify a version, e.g. npm run release -- v1.0.1')
  process.exit(1)
}

const cleanVersion = versionArg.replace(/^v/, '')
const tagName = `v${cleanVersion}`

const run = (command, options = {}) => {
  execSync(command, {
    stdio: 'inherit',
    ...options,
  })
}

const runText = (command, options = {}) => {
  return execSync(command, {
    encoding: 'utf8',
    ...options,
  }).trim()
}

const updateJsonVersion = (filePath) => {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  json.version = cleanVersion
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`)
}

const updateVersions = () => {
  console.log(`Updating version files to ${cleanVersion}...`)

  updateJsonVersion(path.join(__dirname, '../package.json'))
  console.log('Updated package.json')

  updateJsonVersion(path.join(__dirname, '../src-tauri/tauri.conf.json'))
  console.log('Updated src-tauri/tauri.conf.json')

  const cargoTomlPath = path.join(__dirname, '../src-tauri/Cargo.toml')
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8')
  const updatedCargoToml = cargoToml.replace(
    /^version\s*=\s*".*?"$/m,
    `version = "${cleanVersion}"`
  )

  if (cargoToml === updatedCargoToml) {
    throw new Error('Failed to update version in src-tauri/Cargo.toml')
  }

  fs.writeFileSync(cargoTomlPath, updatedCargoToml)
  console.log('Updated src-tauri/Cargo.toml')
}

const syncLocks = () => {
  console.log('Syncing lock files...')
  run('npm install')
  run('cargo update --workspace', {
    cwd: path.join(__dirname, '../src-tauri'),
  })
}

const ensureReleaseBranch = () => {
  const currentBranch = runText('git branch --show-current')
  if (currentBranch === RELEASE_BRANCH) {
    console.log(`Already on '${RELEASE_BRANCH}' branch.`)
    return
  }

  console.log(`Switching from '${currentBranch}' to '${RELEASE_BRANCH}'...`)
  run(`git checkout ${RELEASE_BRANCH}`)
}

const ensureTagDoesNotExist = () => {
  try {
    runText(`git rev-parse --verify ${tagName}`)
    throw new Error(`Tag ${tagName} already exists locally.`)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `Tag ${tagName} already exists locally.`
    ) {
      throw error
    }
  }
}

const commitRelease = () => {
  run('git add -A')
  const status = runText('git status --porcelain')

  if (!status) {
    console.log('No file changes detected after version sync.')
    return false
  }

  run(`git commit -m "release: ${tagName}"`)
  return true
}

const pushRelease = () => {
  run(`git tag ${tagName}`)
  run(`git push origin ${RELEASE_BRANCH}`)
  run(`git push origin ${tagName}`)
}

const main = () => {
  console.log(`Preparing ${tagName} on '${RELEASE_BRANCH}' branch...`)

  ensureReleaseBranch()
  ensureTagDoesNotExist()
  updateVersions()
  syncLocks()

  const hasCommit = commitRelease()
  pushRelease()

  if (hasCommit) {
    console.log(`Release ${tagName} committed and pushed from '${RELEASE_BRANCH}'.`)
    return
  }

  console.log(`No new commit was needed. Existing '${RELEASE_BRANCH}' state was tagged and pushed as ${tagName}.`)
}

try {
  main()
} catch (error) {
  console.error('Release script failed.')
  if (error instanceof Error && error.message) {
    console.error(error.message)
  }
  process.exit(1)
}
