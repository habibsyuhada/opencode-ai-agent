#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, renameSync, symlinkSync, cpSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgRoot = resolve(__dirname, '..')
const templateOpencode = join(pkgRoot, 'template', '.opencode')
const migrateScript = join(pkgRoot, 'scripts', 'migrate-flow-state.mjs')
const cwd = process.cwd()
const targetOpencode = join(cwd, '.opencode')
const args = process.argv.slice(2)
const command = args[0] || 'help'
const flags = new Set(args.slice(1))

function log(msg){ console.log(msg) }
function warn(msg){ console.warn(msg) }
function die(msg, code=1){ console.error(msg); process.exit(code) }
function ts(){ return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '') }
function isSymlink(p){ try { return lstatSync(p).isSymbolicLink() } catch { return false } }
function backupExisting(){
  const backup = join(cwd, `.opencode.backup-${ts()}`)
  renameSync(targetOpencode, backup)
  return backup
}
function createLinkOrCopy({ copy=false, force=false } = {}){
  if(!existsSync(templateOpencode)) die(`Template not found: ${templateOpencode}`)
  if(existsSync(targetOpencode)){
    if(isSymlink(targetOpencode)){
      rmSync(targetOpencode, { recursive: true, force: true })
    } else if(force){
      const backup = backupExisting()
      warn(`Existing .opencode was backed up to: ${relative(cwd, backup)}`)
    } else {
      die(`.opencode already exists and is not a symlink. Use --force to back it up, or --copy if you intentionally want a local copy.`)
    }
  }
  if(copy){
    cpSync(templateOpencode, targetOpencode, { recursive: true })
    log(`Installed local copy: ${relative(cwd, targetOpencode)}`)
    return
  }
  try{
    const type = process.platform === 'win32' ? 'junction' : 'dir'
    symlinkSync(templateOpencode, targetOpencode, type)
    log(`Installed symlink: ${relative(cwd, targetOpencode)} -> ${templateOpencode}`)
  } catch(err){
    die(`Failed to create symlink: ${err.message}\nTry: armiai install --copy`)
  }
}
function readJson(path){ try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }
function hasBin(name){
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [name] : ['-v', name], { shell: process.platform !== 'win32', encoding: 'utf8' })
  return r.status === 0
}
function runNodeScript(script){
  if(!existsSync(script)) die(`Script not found: ${script}`)
  const r = spawnSync(process.execPath, [script], { cwd, stdio: 'inherit' })
  process.exit(r.status ?? 1)
}
function projectDocsSummary(){
  const paths = [
    'docs/prd/prd.md',
    'docs/architecture/architecture.md',
    'docs/stories',
    'docs/dev-notes',
    'docs/qa',
    'docs/release',
    'docs/flow-state/flow-state.json'
  ]
  for(const p of paths){
    const full = join(cwd, p)
    if(existsSync(full)){
      if(lstatSync(full).isDirectory()) log(`✓ ${p} (${readdirSync(full).length} items)`)
      else log(`✓ ${p}`)
    } else log(`- ${p}`)
  }
}
function printStatus(){
  const statePath = join(cwd, 'docs', 'flow-state', 'flow-state.json')
  const state = readJson(statePath)
  if(!state){
    warn('No docs/flow-state/flow-state.json found. Run: armiai migrate')
    projectDocsSummary()
    return
  }
  log(`Workflow: ${state.workflow_id || '-'}`)
  log(`Version: ${state.version || '-'}`)
  log(`Updated: ${state.updated_at || '-'}`)
  log(`Current stage: ${state.current_stage || '-'}`)
  log(`Next action: ${state.next_action || '-'}`)
  const stories = Object.values(state.stories || {})
  if(stories.length){
    const counts = stories.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc }, {})
    log(`Stories: ${stories.length}`)
    for(const [k,v] of Object.entries(counts)) log(`  ${k}: ${v}`)
  }
}
function printResumePlan(){
  const statePath = join(cwd, 'docs', 'flow-state', 'flow-state.json')
  const state = readJson(statePath)
  if(!state) die('No flow-state found. Run: armiai migrate')
  log('# Resume Plan')
  log(`Next action: ${state.next_action || '-'}`)
  const pending = Object.values(state.stories || {}).filter(s => s.status !== 'CLOSED')
  if(!pending.length){ log('All discovered stories are closed.'); return }
  const next = pending[0]
  log(`Next story: ${next.story_id}`)
  log(`Status: ${next.status}`)
  log(`Action: ${next.next_action}`)
  log('Suggested prompt:')
  log(`Armi, continue this project from checkpoint. Start with ${next.story_id}. Do not redo completed stages.`)
}
function doctor(){
  log('ArmiAI Doctor')
  log(`Package root: ${pkgRoot}`)
  log(`Template: ${templateOpencode} ${existsSync(templateOpencode) ? '✓' : 'MISSING'}`)
  log(`Project: ${cwd}`)
  if(existsSync(targetOpencode)){
    log(`Project .opencode: ${isSymlink(targetOpencode) ? 'symlink ✓' : 'directory/file exists'}`)
  } else log('Project .opencode: missing')
  log(`Node: ${process.version}`)
  log(`opencode binary: ${hasBin('opencode') ? 'found' : 'not found in PATH'}`)
  projectDocsSummary()
}
function usage(){
  log(`ArmiAI v1\n\nUsage:\n  armiai install [--force] [--copy]\n  armiai update [--force] [--copy]\n  armiai migrate\n  armiai status\n  armiai resume-plan\n  armiai doctor\n  armiai where\n  armiai uninstall [--force]\n\nRecommended for each project:\n  armiai install\n  armiai migrate\n  armiai status\n\nNotes:\n  - Default install uses a symlink, so the agent template is not copied into every repo.\n  - Project-specific continuity is stored under docs/flow-state/.\n  - Use --copy only if your OS blocks symlinks.`)
}

switch(command){
  case 'install':
  case 'link':
    createLinkOrCopy({ copy: flags.has('--copy'), force: flags.has('--force') })
    break
  case 'update':
  case 'relink':
    createLinkOrCopy({ copy: flags.has('--copy'), force: flags.has('--force') || isSymlink(targetOpencode) })
    break
  case 'uninstall':
  case 'remove':
    if(!existsSync(targetOpencode)){ log('.opencode is already absent.'); break }
    if(isSymlink(targetOpencode) || flags.has('--force')){
      rmSync(targetOpencode, { recursive:true, force:true })
      log('Removed project .opencode link/copy.')
    } else die('.opencode is not a symlink. Refusing to remove without --force.')
    break
  case 'migrate':
  case 'migrate-flow':
    runNodeScript(migrateScript)
    break
  case 'status':
    printStatus()
    break
  case 'resume':
  case 'resume-plan':
    printResumePlan()
    break
  case 'doctor':
    doctor()
    break
  case 'where':
    log(templateOpencode)
    break
  case 'help':
  case '--help':
  case '-h':
    usage()
    break
  case 'version':
  case '--version':
  case '-v':
    log('1.0.0')
    break
  default:
    warn(`Unknown command: ${command}`)
    usage()
    process.exit(1)
}
