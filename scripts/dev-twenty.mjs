import {readFile,writeFile,mkdir,chmod,cp,symlink,access} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPreflight} from './dev-preflight.mjs';
import {assertLaunchedService} from './dev-process.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const local=resolve(root,'.local'),runtime=resolve(root,'.runtime/twenty');
const source=resolve(root,'../twenty');
const clean={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8'};
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
async function credentials(){
 await mkdir(local,{recursive:true,mode:0o700});await chmod(local,0o700);
 const path=resolve(local,'dev.env');
 if(!await exists(path)){
  const password=randomBytes(24).toString('hex');
  const env={ISOLATION_ID:'company-helper-crm-dev',POSTGRES_USER:'company_helper_dev',POSTGRES_PASSWORD:password,TWENTY_DATABASE_URL:`postgres://company_helper_dev:${password}@127.0.0.1:15432/company_helper_twenty_dev`,BUSINESS_DATABASE_URL:`postgres://company_helper_dev:${password}@127.0.0.1:15432/company_helper_business_dev`,REDIS_URL:'redis://127.0.0.1:16379/0',APP_SECRET:randomBytes(48).toString('hex'),ENCRYPTION_KEY:randomBytes(32).toString('hex')};
  await writeFile(path,Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
 }
 await chmod(path,0o600);
 return Object.fromEntries((await readFile(path,'utf8')).trim().split('\n').map(line=>{const n=line.indexOf('=');return [line.slice(0,n),line.slice(n+1)];}));
}
function run(exe,args,options={}){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{cwd:root,env:clean,stdio:'inherit',...options});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`Command failed (${code}); inspect isolated logs`)));});}
const env=await credentials();
const config={environment:'development',isolationId:env.ISOLATION_ID,twentyPort:3100,businessApiPort:8788,twentyDatabaseUrl:env.TWENTY_DATABASE_URL,businessDatabaseUrl:env.BUSINESS_DATABASE_URL,redisUrl:env.REDIS_URL};
const action=process.argv[2]||'up';
const preflight=await runPreflight(config,{checkPorts:action==='up'});
if(!preflight.ok){console.error(preflight.checks.filter(c=>!c.ok));process.exit(1);}
const compose=['compose','--project-name','company-helper-crm-dev','--env-file',resolve(local,'dev.env'),'-f',resolve(root,'dev/compose.yaml')];
const labels=['org.codex.company-helper-crm-dev.server','org.codex.company-helper-crm-dev.worker','org.codex.company-helper-crm-dev.api'];
const domain=`gui/${process.getuid()}`;
if(action==='down'){
 for(const label of labels){try{execFileSync('launchctl',['remove',label],{stdio:'ignore'});}catch{}}
 await run('docker',[...compose,'stop']);console.log('Isolated processes and containers stopped; volumes retained.');process.exit(0);
}
if(action!=='up')throw new Error('Use up or down');
const sha=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(sha!=='ab962b01c4fdb26cf3cffcc770c7bed0c38bb53e')throw new Error('Twenty source pin mismatch');
const version=(await readFile(resolve(source,'.nvmrc'),'utf8')).trim();
const node=execFileSync('fnm',['exec','--using',version,'--','node','-p','process.execPath'],{encoding:'utf8',env:clean}).trim();
const scripts=JSON.parse(await readFile(resolve(source,'packages/twenty-server/package.json'),'utf8')).scripts;
if(scripts['start:prod']!=='node dist/main'||scripts['worker:prod']!=='node dist/queue-worker/queue-worker')throw new Error('Source entry definitions changed');
await mkdir(runtime,{recursive:true,mode:0o700});await chmod(resolve(root,'.runtime'),0o700);
if(!await exists(resolve(runtime,'dist')))await cp(resolve(source,'packages/twenty-server/dist'),resolve(runtime,'dist'),{recursive:true});
if(!await exists(resolve(runtime,'node_modules')))await symlink(resolve(source,'node_modules'),resolve(runtime,'node_modules'));
await writeFile(resolve(runtime,'package.json'),'{"private":true,"type":"commonjs"}\n');
for(const dir of ['storage','functions','logs'])await mkdir(resolve(runtime,dir),{recursive:true,mode:0o700});
const twentyEnv={NODE_ENV:'production',NODE_PORT:'3100',SERVER_URL:'http://localhost:3100',PG_DATABASE_URL:env.TWENTY_DATABASE_URL,REDIS_URL:env.REDIS_URL,APP_SECRET:env.APP_SECRET,ENCRYPTION_KEY:env.ENCRYPTION_KEY,STORAGE_TYPE:'local',STORAGE_LOCAL_PATH:resolve(runtime,'storage'),LOGIC_FUNCTION_TYPE:'DISABLED',IS_CONFIG_VARIABLES_IN_DB_ENABLED:'false',TELEMETRY_ENABLED:'false',MARKETPLACE_CATALOG_SYNC_CRON_ENABLED:'false',ALLOW_REQUESTS_TO_TWENTY_ICONS:'false',SIGN_IN_PREFILLED:'false',IS_MULTIWORKSPACE_ENABLED:'false'};
await writeFile(resolve(runtime,'.env'),Object.entries(twentyEnv).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
await run('docker',[...compose,'up','-d','--wait']);
await run('docker',[...compose,'exec','-T','postgres','sh','-c','psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname=\'company_helper_business_dev\'" | grep -q 1 || createdb -U "$POSTGRES_USER" company_helper_business_dev']);
const nodeRun=args=>run(node,args,{cwd:runtime,env:{...clean,...twentyEnv}});
const databaseReady=execFileSync('docker',[...compose,'exec','-T','postgres','sh','-c',`psql -U "$POSTGRES_USER" -d company_helper_twenty_dev -tAc "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_schema='core' AND table_name='upgradeMigration')"`],{encoding:'utf8',env:clean}).trim()==='t';
if(!databaseReady || !await exists(resolve(runtime,'initialized'))){
 await nodeRun(['dist/database/scripts/setup-db.js']);
 await nodeRun(['dist/command/command.js','run-instance-commands','--force','--include-slow']);
 await nodeRun(['dist/command/command.js','cache:flush']);
 await nodeRun(['dist/command/command.js','upgrade']);
 await nodeRun(['dist/command/command.js','cache:flush']);
 await nodeRun(['dist/command/command.js','cron:register:all']);
 await writeFile(resolve(runtime,'initialized'),sha+'\n');
}
await run(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',resolve(root,'apps/business-api/tsconfig.build.json')]);
const services=[];
for(const [index,entry] of ['dist/main.js','dist/queue-worker/queue-worker.js',null].entries()){
 const log=`/tmp/company-helper-crm-dev-${index}.log`;await writeFile(log,'',{mode:0o600});
 const exe=index===2?process.execPath:node;
 const args=index===2?[...(await exists(resolve(local,'business-api.env'))?['--env-file='+resolve(local,'business-api.env')]:[]),resolve(root,'.runtime/business-api/apps/business-api/src/index.js')]:['--env-file=.env',entry];
 const cwd=index===2?root:runtime;
 services.push({domain,label:labels[index],command:[exe,...args].join(' '),...(index===0?{port:3100}:index===2?{port:8788}:{})});
 // launchctl gets only our explicit environment via env -i. Never inherit user application secrets.
 await run('launchctl',['submit','-l',labels[index],'-o',log,'-e',log,'--','/bin/bash','-c','cd "$1" && shift && exec /usr/bin/env -i "$@"','isolated-runtime',cwd,...Object.entries({...clean,...(index===2?{NODE_ENV:'development'}:{NODE_ENV:'production'})}).filter(([,v])=>v!==undefined).map(([k,v])=>`${k}=${v}`),exe,...args]);
}
for(const [index,url] of [[0,'http://127.0.0.1:3100/healthz'],[2,'http://127.0.0.1:8788/health']]) {
 let healthy=false;
 for(let attempt=0;attempt<120;attempt++) {try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok && (await r.json()).status==='ok'){assertLaunchedService(services[index]);healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!healthy)throw new Error(`Health check failed: ${url}; inspect /tmp/company-helper-crm-dev-*.log`);
}
for(const service of services)assertLaunchedService(service);
console.log('Isolated health verified: Twenty3100 / business8788; logs /tmp/company-helper-crm-dev-{0,1,2}.log.');
