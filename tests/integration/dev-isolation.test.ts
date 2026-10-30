import {describe,it,expect} from 'vitest';
import net from 'node:net';
import {runPreflight} from '../../scripts/dev-preflight.mjs';
const valid = {environment:'development',isolationId:'company-helper-crm-dev',twentyPort:3100,businessApiPort:8788,twentyDatabaseUrl:'postgres://dev:fake@127.0.0.1:15432/company_helper_twenty_dev',businessDatabaseUrl:'postgres://dev:fake@127.0.0.1:15432/company_helper_business_dev',redisUrl:'redis://127.0.0.1:16379/0'};
describe('development isolation',()=>{
 it('accepts explicitly isolated targets',async()=>expect((await runPreflight(valid)).ok).toBe(true));
 it.each([{twentyPort:3000},{businessApiPort:3000},{isolationId:undefined},{environment:'production'},{twentyDatabaseUrl:'postgres://dev:fake@localhost:5432/default'},{businessDatabaseUrl:valid.twentyDatabaseUrl},{redisUrl:'redis://localhost:6379'},{twentyDatabaseUrl:'postgres://dev:fake@remote:15432/company_helper_twenty_dev'},{businessDatabaseUrl:'postgres://dev:fake@127.0.0.1:15432/default'}])('rejects unsafe config %j',async(patch)=>expect((await runPreflight({...valid,...patch})).ok).toBe(false));
 it('refuses occupied application ports without terminating the listener',async()=>{const server=net.createServer();await new Promise<void>((r,reject)=>{server.once('error',(e:NodeJS.ErrnoException)=>e.code==='EADDRINUSE'?r():reject(e));server.listen(3100,'127.0.0.1',r);});try {expect((await runPreflight(valid,{checkPorts:true})).ok).toBe(false);await new Promise<void>((r,reject)=>{const socket=net.connect(3100,'127.0.0.1',()=>{socket.destroy();r();});socket.once('error',reject);});}finally{if(server.listening)await new Promise<void>(r=>server.close(()=>r()));}});
});
