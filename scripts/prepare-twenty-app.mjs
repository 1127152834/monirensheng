import {readFile,writeFile,mkdir,cp,symlink,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname),source=resolve(root,'../twenty'),stage=resolve(root,'.local/twenty-cli-stage'),app=resolve(root,'apps/twenty-app');
const pin='ab962b01c4fdb26cf3cffcc770c7bed0c38bb53e';
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin)throw Error('Twenty source pin mismatch');
if(process.versions.node.split('.')[0]!=='24')throw Error('Node24 required');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const link=async(from,to)=>{if(!await exists(to))await symlink(from,to,'dir');};
if(!await exists(stage)){
 await mkdir(join(stage,'packages'),{recursive:true,mode:0o700});
 await cp(join(source,'packages/twenty-cli'),join(stage,'packages/twenty-cli'),{recursive:true,filter:p=>!p.includes('/node_modules')&&!p.includes('/dist')});
 await mkdir(join(stage,'packages/twenty-sdk'));await cp(join(source,'packages/twenty-sdk/package.json'),join(stage,'packages/twenty-sdk/package.json'));await cp(join(source,'tsconfig.base.json'),join(stage,'tsconfig.base.json'));
 await link(join(source,'node_modules'),join(stage,'node_modules'));await link(join(source,'packages/twenty-cli/node_modules'),join(stage,'packages/twenty-cli/node_modules'));
 const path=join(stage,'packages/twenty-cli/vite.config.ts');let config=await readFile(path,'utf8');const needle="cacheDir: '../../node_modules/.vite/packages/twenty-cli',";if(!config.includes(needle))throw Error('Review Vite config');
 config="import {fileURLToPath} from 'node:url';\n"+config.replace(needle,"cacheDir: path.resolve(__dirname, '.vite-cache'),");config=config.replace("export default defineConfig", "const __dirname = path.dirname(fileURLToPath(import.meta.url));\n\nexport default defineConfig");await writeFile(path,config);
 await writeFile(join(stage,'packages/twenty-cli/src/config/get-config-path.ts'),`export const getConfigPath = (): string => {const path=process.env.COMPANY_HELPER_TWENTY_CONFIG_PATH;if(!path)throw Error('COMPANY_HELPER_TWENTY_CONFIG_PATH required');return path;};\n`);
 execFileSync(process.execPath,[join(source,'node_modules/vite/bin/vite.js'),'build','--config','vite.config.ts','--configLoader','runner'],{cwd:join(stage,'packages/twenty-cli'),stdio:'inherit'});
}
const cli=join(stage,'packages/twenty-cli/dist/cli.cjs'),config=join(root,'.local/twenty-cli-config.json');
// Existing stages must retain the mandatory independent config guard.
if(!(await readFile(join(stage,'packages/twenty-cli/src/config/get-config-path.ts'),'utf8')).includes('COMPANY_HELPER_TWENTY_CONFIG_PATH'))throw Error('Unsafe stage config');
await mkdir(join(app,'node_modules'),{recursive:true});for(const p of ['twenty-sdk','twenty-client-sdk','twenty-ui','twenty-shared'])await link(join(source,'packages',p),join(app,'node_modules',p));for(const p of ['react','react-dom','@types','typescript','vite-tsconfig-paths','preact','tslib'])await link(join(source,'node_modules',p),join(app,'node_modules',p));
await cp(join(source,'yarn.lock'),join(app,'yarn.lock'));
const hash=createHash('sha256').update(await readFile(join(source,'yarn.lock'))).digest('hex');
await writeFile(join(root,'.local/twenty-toolchain-evidence.json'),JSON.stringify({sourcePin:pin,node:process.version,sourceYarnLockSha256:hash,cli,app,independentConfig:config},null,2),{mode:0o600});
execFileSync(process.execPath,[cli,'--version'],{env:{...process.env,COMPANY_HELPER_TWENTY_CONFIG_PATH:config},stdio:'inherit'});
console.log('Pinned local SDK dependencies prepared; source untouched. App yarn.lock is a copied upstream dependency snapshot, not a portable app lock.');
