#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
function files(dir){ return existsSync(dir) ? readdirSync(dir).filter(f=>f.endsWith('.md')) : [] }
function sid(f){ const m=f.match(/STORY-(\d{3})/); return m ? `STORY-${m[1]}` : null }
mkdirSync('docs/flow-state/story-state', {recursive:true})
const prd=existsSync('docs/prd/prd.md')
const arch=existsSync('docs/architecture/architecture.md')
const stories=files('docs/stories').map(sid).filter(Boolean)
const dev=files('docs/dev-notes'), qa=files('docs/qa'), rel=files('docs/release'), rev=files('docs/reviews')
const storyStates={}
for(const s of stories){
  const devn=dev.find(f=>f.includes(`DEV-NOTES-${s}`)), block=dev.find(f=>f.includes(`BLOCKER-${s}`)), bugfix=dev.find(f=>f.includes(`BUGFIX-NOTES-${s}`))
  const qar=qa.find(f=>f.includes(`QA-REVIEW-${s}`)), bug=qa.find(f=>f.includes(`BUG-REPORT-${s}`)), release=rel.find(f=>f.includes(`merge-close-${s}`))
  const code=rev.find(f=>f.includes(`CODE-REVIEW-${s}`)), front=rev.find(f=>f.includes(`FRONTEND-REVIEW-${s}`))
  let status='PENDING_DEV', next_action='queue_or_develop_story'
  if(block){status='BLOCKED';next_action='resolve_blocker'} else if(release){status='CLOSED';next_action='none'} else if(bug&&!bugfix){status='QA_FAILED';next_action='route_to_bugfix_developer'} else if(qar&&!release){status='QA_DONE';next_action='route_to_release_close'} else if(devn&&!qar){status='DEV_DONE';next_action='route_to_reviews_or_qa'}
  if(devn&&!code) next_action='route_to_code_reviewer_before_qa'
  storyStates[s]={story_id:s,status,next_action,artifacts:{story:`docs/stories/${s}.md`,dev_notes:devn?`docs/dev-notes/${devn}`:null,blocker:block?`docs/dev-notes/${block}`:null,bugfix_notes:bugfix?`docs/dev-notes/${bugfix}`:null,qa_review:qar?`docs/qa/${qar}`:null,bug_report:bug?`docs/qa/${bug}`:null,code_review:code?`docs/reviews/${code}`:null,frontend_review:front?`docs/reviews/${front}`:null,release:release?`docs/release/${release}`:null},updated_at:new Date().toISOString()}
  writeFileSync(`docs/flow-state/story-state/${s}.json`, JSON.stringify(storyStates[s], null, 2)+'\n')
}
const next=Object.values(storyStates).find(s=>s.status!=='CLOSED')
const state={workflow_id:`migrated-${Date.now()}`,version:'2.0-low-token-resumable',updated_at:new Date().toISOString(),current_stage:next?next.story_id:(stories.length?'all_stories_closed':'prd'),stages:{prd:{agent:'product-owner',status:prd?'DONE':'PENDING',required_artifacts:['docs/prd/prd.md'],verified_artifacts:prd?['docs/prd/prd.md']:[]},architecture:{agent:'solution-architect',status:arch?'DONE':'PENDING',required_artifacts:['docs/architecture/architecture.md'],verified_artifacts:arch?['docs/architecture/architecture.md']:[]},story_sharding:{agent:'story-sharding-agent',status:stories.length?'DONE':'PENDING',required_artifacts:['docs/stories/STORY-001.md'],verified_artifacts:stories.map(s=>`docs/stories/${s}.md`)}},stories:storyStates,next_action:next?`${next.story_id}: ${next.next_action}`:(stories.length?'no_pending_story':'create_prd')}
writeFileSync('docs/flow-state/flow-state.json', JSON.stringify(state,null,2)+'\n')
writeFileSync('docs/flow-state/MIGRATION-REPORT.md', `# Flow State Migration Report\n\nUpdated: ${state.updated_at}\n\n- PRD: ${prd?'found':'missing'}\n- Architecture: ${arch?'found':'missing'}\n- Stories found: ${stories.length}\n- Closed stories: ${Object.values(storyStates).filter(s=>s.status==='CLOSED').length}\n- Next action: ${state.next_action}\n`)
console.log(`Wrote docs/flow-state/flow-state.json`)
console.log(`Next action: ${state.next_action}`)
