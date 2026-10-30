import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {loadFixture,login,base} from '../../scripts/foundation-client.mjs';
const live=process.env.M0_NATIVE_INTEGRATION==='1';
let f:any,e:any,db:any;
const endpoint='http://127.0.0.1:8788/api/foundation/customers';
async function patch(who:string,id:string,body:any){return fetch(endpoint+'/'+id,{method:'PATCH',headers:{Authorization:`Bearer ${f[who].token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
describe.skipIf(!live)('live authoritative foundation API',()=>{
 beforeAll(async()=>{f=await loadFixture();e=JSON.parse(await readFile('.local/foundation-extension.json','utf8'));for(const who of ['a','b','admin'])f[who].token=await login(f[who],base);
 const env=Object.fromEntries((await readFile('.local/business-api.env','utf8')).trim().split('\n').map(x=>{const n=x.indexOf('=');return[x.slice(0,n),x.slice(n+1)];}));const {Pool}=await import('pg');db=new Pool({connectionString:env.BUSINESS_DATABASE_URL});});
 afterAll(async()=>{if(db)await db.end();});
 it('A updates X; B denied with database and audit unchanged',async()=>{
 const x=e.customers[0];expect((await patch('a',x.id,{displayName:'合成客户 X API',expectedOwnerVersion:1})).status).toBe(200);
 const before=await db.query('SELECT display_name,revision FROM foundation_customers WHERE id=$1',[x.id]);
 const count=await db.query('SELECT count(*) FROM foundation_events WHERE customer_id=$1',[x.id]);
 expect((await patch('b',x.id,{displayName:'forbidden',expectedOwnerVersion:1})).status).toBe(403);
 expect((await db.query('SELECT display_name,revision FROM foundation_customers WHERE id=$1',[x.id])).rows).toEqual(before.rows);
 expect((await db.query('SELECT count(*) FROM foundation_events WHERE customer_id=$1',[x.id])).rows).toEqual(count.rows);
 });
 it('admin can update X and Y, but body cannot assign owners or authority',async()=>{for(const x of e.customers){expect((await patch('admin',x.id,{displayName:x.displayName+' 管理验证',expectedOwnerVersion:1})).status).toBe(200);for(const extra of [{ownerUserId:f.b.identity.id},{userId:f.admin.identity.id},{isBusinessAdmin:true}])expect((await patch('a',x.id,{displayName:'forged',expectedOwnerVersion:1,...extra})).status).toBe(400);}});
 it('stale versions and bad tokens fail',async()=>{expect((await patch('a',e.customers[0].id,{displayName:'stale',expectedOwnerVersion:2})).status).toBe(409);expect((await fetch(endpoint,{headers:{Authorization:'Bearer invalid'}})).status).toBe(401);});
 it('commit includes matching true actor event and durable outbox',async()=>{const x=e.customers[0];expect((await patch('a',x.id,{displayName:'合成客户 X 事务验证',expectedOwnerVersion:1})).status).toBe(200);const rows=(await db.query('SELECT e.actor_user_id,e.owner_version,e.payload,o.id FROM foundation_events e JOIN foundation_outbox o ON e.id=o.id WHERE e.customer_id=$1 ORDER BY e.created_at DESC LIMIT 1',[x.id])).rows;expect(rows[0].actor_user_id).toBe(f.a.identity.id);expect(rows[0].owner_version).toBe(1);expect(rows[0].payload.displayName).toBe('合成客户 X 事务验证');expect(rows[0].id).toBeTruthy();});
 it('CORS accepts opaque worker origin with bearer only',async()=>{const r=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'null','Access-Control-Request-Method':'PATCH','Access-Control-Request-Headers':'authorization,content-type'}});expect(r.status).toBe(204);expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');expect(r.headers.get('Access-Control-Allow-Credentials')).toBeNull();});
});
