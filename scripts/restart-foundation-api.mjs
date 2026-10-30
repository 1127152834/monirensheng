import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {assertLaunchedService} from './dev-process.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);if(!root.endsWith('/company-helper-crm-m0'))throw Error('M0 worktree required');
execFileSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',resolve(root,'apps/business-api/tsconfig.build.json')],{cwd:root,stdio:'inherit'});
const label='org.codex.company-helper-crm-dev.api';try{execFileSync('launchctl',['remove',label],{stdio:'ignore'});}catch{}
const entry=resolve(root,'.runtime/business-api/apps/business-api/src/index.js');const args=['--env-file='+resolve(root,'.local/business-api.env'),entry];
execFileSync('launchctl',['submit','-l',label,'-o','/tmp/company-helper-crm-dev-2.log','-e','/tmp/company-helper-crm-dev-2.log','--',process.execPath,...args],{cwd:root,stdio:'inherit'});
let ok=false;for(let n=0;n<50;n++){try{if((await fetch('http://127.0.0.1:8788/health')).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
if(!ok)throw Error('Isolated API health failed');assertLaunchedService({domain:`gui/${process.getuid()}`,label,command:[process.execPath,...args].join(' '),port:8788});console.log('Isolated API restarted and verified on8788.');
