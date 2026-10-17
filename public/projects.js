import {normalize} from './geometry.js';
export const PROJECTS_KEY='form-projects-v2';
const ID=/^[a-zA-Z0-9_-]{8,100}$/;
export const newId=()=>crypto.randomUUID();
export function identity(s){if(!ID.test(s.projectId||''))s.projectId=newId();return s;}
export function readProjects(storage=localStorage){const raw=storage.getItem(PROJECTS_KEY);if(!raw)return {schema:2,projects:[]};const data=JSON.parse(raw);if(data.schema!==2||!Array.isArray(data.projects))throw Error('Unsupported project store');return data;}
export function saveRevision(state,storage=localStorage){identity(state);const db=readProjects(storage);let p=db.projects.find(p=>p.id===state.projectId);if(!p){p={id:state.projectId,name:state.name,createdAt:new Date().toISOString(),archived:false,revisions:[]};db.projects.push(p);}p.name=state.name;p.updatedAt=new Date().toISOString();const revision={id:newId(),createdAt:p.updatedAt,state:structuredClone(state)};revision.state.revisionId=revision.id;p.revisions.push(revision);storage.setItem(PROJECTS_KEY,JSON.stringify(db));return revision;}
export function migrateProjects(storage=localStorage){
 const db=readProjects(storage);if(db.migrated)return db;
 const saved=JSON.parse(storage.getItem('form-studio-saved-v1')||'[]'),runs=JSON.parse(storage.getItem('form-analysis-history-v1')||'[]');
 // Do not infer identity from names: a legacy snapshot starts its own project.
 for(const item of saved){const s=structuredClone(item.state);identity(s);const id=newId();s.revisionId=id;db.projects.push({id:s.projectId,name:s.name,createdAt:item.date,updatedAt:item.date,archived:false,legacySavedSignature:JSON.stringify(item),revisions:[{id,createdAt:item.date,state:s}]});}
 for(const run of runs){if(!run.result?.project)continue;const s=structuredClone(run.result.project);identity(s);const id=newId();s.revisionId=id;db.projects.push({id:s.projectId,name:s.name||run.name,createdAt:run.savedAt,updatedAt:run.savedAt,archived:false,legacyRunIds:[run.id],revisions:[{id,createdAt:run.savedAt,state:s}]});}
 db.migrated=true;storage.setItem(PROJECTS_KEY,JSON.stringify(db));return db;
}
export function projectBundle(id,storage=localStorage){const project=readProjects(storage).projects.find(p=>p.id===id);if(!project)throw Error('Project not found');const runs=JSON.parse(storage.getItem('form-analysis-history-v1')||'[]').filter(r=>r.result.project?.projectId===id||project.legacyRunIds?.includes(r.id));return {schema:'form-project-bundle-v2',project,runs,exportedAt:new Date().toISOString()};}
export function validateBundle(b){if(b?.schema!=='form-project-bundle-v2'||!ID.test(b.project?.id||'')||!Array.isArray(b.project.revisions)||!Array.isArray(b.runs))throw Error('Invalid project bundle');if(b.project.revisions.length>500||b.runs.length>100)throw Error('Bundle exceeds supported limits');for(const r of b.project.revisions){if(!ID.test(r.id)||![1,2].includes(r.state?.version)||r.state.projectId!==b.project.id)throw Error('Invalid revision');normalize(r.state);}for(const r of b.runs)if(!r.id||!['sunlight','radiation','daylight','sky'].includes(r.result?.settings?.analysis)||!Array.isArray(r.result?.values)||!r.result.values.length||r.result.values.some(v=>!Number.isFinite(v)))throw Error('Invalid analysis run');return b;}
export function importBundle(bundle,storage=localStorage){const b=validateBundle(bundle),db=readProjects(storage),runs=JSON.parse(storage.getItem('form-analysis-history-v1')||'[]');let p=db.projects.find(p=>p.id===b.project.id);if(!p){p=structuredClone(b.project);db.projects.push(p);}else{for(const rev of b.project.revisions){const old=p.revisions.find(x=>x.id===rev.id);if(old&&JSON.stringify(old)!==JSON.stringify(rev))throw Error('Conflicting revision ID; nothing imported');if(!old)p.revisions.push(rev);}}
 for(const run of b.runs){const old=runs.find(x=>x.id===run.id);if(old&&JSON.stringify(old)!==JSON.stringify(run))throw Error('Conflicting analysis ID; nothing imported');if(!old)runs.push(run);}
 if(runs.length>100)throw Error('Too many saved analyses');
 const oldRuns=storage.getItem('form-analysis-history-v1');storage.setItem('form-analysis-history-v1',JSON.stringify(runs));try{storage.setItem(PROJECTS_KEY,JSON.stringify(db));}catch(e){if(oldRuns===null)storage.removeItem('form-analysis-history-v1');else storage.setItem('form-analysis-history-v1',oldRuns);throw e;}return p;
}
