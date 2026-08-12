import fs from 'fs'
import path from 'path'
import { execFileSync, execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_RELEASE_BRANCH = 'main'
const SEMVER_TAG_PATTERN =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const printUsage = () => {
  console.log('Usage: npm run release -- --tag <tag> [--branch <branch>]')
  console.log('Example: npm run release -- --tag v2.0.0 (default branch: main)')
}

const parseArgs = (args) => {
  let branchName = DEFAULT_RELEASE_BRANCH
  let tagName
  let branchSpecified = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }

    if (arg === '--branch' || arg.startsWith('--branch=')) {
      if (branchSpecified) {
        throw new Error('--branch can only be specified once.')
      }

      branchSpecified = true
      const inlineValue = arg.startsWith('--branch=') ? arg.slice('--branch='.length) : undefined
      const nextValue = args[index + 1]
      if (inlineValue !== undefined) {
        branchName = inlineValue || DEFAULT_RELEASE_BRANCH
      } else if (nextValue && !nextValue.startsWith('--')) {
        branchName = nextValue
        index += 1
      }
      continue
    }

    if (arg === '--tag' || arg.startsWith('--tag=')) {
      if (tagName !== undefined) {
        throw new Error('--tag can only be specified once.')
      }

      const inlineValue = arg.startsWith('--tag=') ? arg.slice('--tag='.length) : undefined
      const nextValue = args[index + 1]
      if (inlineValue !== undefined) {
        tagName = inlineValue
      } else if (nextValue && !nextValue.startsWith('--')) {
        tagName = nextValue
        index += 1
      } else {
        throw new Error('--tag requires a value.')
      }
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!tagName) {
    throw new Error('Please specify a tag, e.g. npm run release -- --tag v2.0.0')
  }

  if (!SEMVER_TAG_PATTERN.test(tagName)) {
    throw new Error(`Invalid tag '${tagName}'. Expected a semantic version prefixed with 'v'.`)
  }

  return { branchName, tagName }
}

const getReleaseOptions = () => {
  try {
    return parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error('Release script failed.')
    if (error instanceof Error && error.message) {
      console.error(error.message)
    }
    printUsage()
    process.exit(1)
  }
}

const { branchName, tagName } = getReleaseOptions()
const cleanVersion = tagName.slice(1)

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

const runGit = (args, options = {}) => {
  execFileSync('git', args, {
    stdio: 'inherit',
    ...options,
  })
}

const runGitText = (args, options = {}) => {
  return execFileSync('git', args, {
    encoding: 'utf8',
    ...options,
  }).trim()
}

const validateGitRefs = () => {
  try {
    execFileSync('git', ['check-ref-format', '--branch', branchName], { stdio: 'pipe' })
    execFileSync('git', ['check-ref-format', `refs/tags/${tagName}`], { stdio: 'pipe' })
  } catch {
    throw new Error(`Invalid branch or tag name: branch='${branchName}', tag='${tagName}'.`)
  }
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
    `version = "${cleanVersion}"`,
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
  const currentBranch = runGitText(['branch', '--show-current'])
  if (currentBranch === branchName) {
    console.log(`Already on '${branchName}' branch.`)
    return
  }

  console.log(`Switching from '${currentBranch || 'detached HEAD'}' to '${branchName}'...`)
  runGit(['checkout', branchName])
}

const ensureTagDoesNotExist = () => {
  if (runGitText(['tag', '--list', tagName]) === tagName) {
    throw new Error(`Tag ${tagName} already exists locally.`)
  }
}

const commitRelease = () => {
  run('git add -A')
  const status = runText('git status --porcelain')

  if (!status) {
    console.log('No file changes detected after version sync.')
    return false
  }

  runGit(['commit', '-m', `release: ${tagName}`])
  return true
}

const pushRelease = () => {
  runGit(['tag', tagName])
  runGit(['push', 'origin', branchName])
  runGit(['push', 'origin', tagName])
}

const main = () => {
  console.log(`Preparing ${tagName} on '${branchName}' branch...`)

  validateGitRefs()
  ensureReleaseBranch()
  ensureTagDoesNotExist()
  updateVersions()
  syncLocks()

  const hasCommit = commitRelease()
  pushRelease()

  if (hasCommit) {
    console.log(`Release ${tagName} committed and pushed from '${branchName}'.`)
    return
  }

  console.log(
    `No new commit was needed. Existing '${branchName}' state was tagged and pushed as ${tagName}.`,
  )
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
