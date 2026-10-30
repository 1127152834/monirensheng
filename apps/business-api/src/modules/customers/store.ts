import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import type {Principal} from '../../../../../packages/contracts/src/identity.js';
import {assertCustomerAction,CustomerError} from './access.js';
export const pool=new Pool({connectionString:process.env.BUSINESS_DATABASE_URL});
export const columns=`c.id,c.display_name AS "displayName",c.owner_user_id AS "ownerUserId",c.owner_version AS "ownerVersion",c.revision::text AS revision,EXISTS(SELECT 1 FROM foundation_outbox o WHERE o.customer_id=c.id AND o.delivered_at IS NULL) AS "projectionPending"`;
export async function listCustomers(principal:Principal){
 if(!principal.permissions.includes('customer.read'))throw new CustomerError(403,'FEATURE_PERMISSION_REQUIRED');
 const {rows}=await pool.query(`SELECT ${columns} FROM foundation_customers c WHERE workspace_id=$1 ORDER BY id`,[principal.workspaceId]);
 return rows.map(row=>({...row,canUpdate:principal.permissions.includes('customer.update')&&(principal.isBusinessAdmin||row.ownerUserId===principal.userId)}));
}
export async function updateCustomer(principal:Principal,id:string,command:{displayName:string;expectedOwnerVersion:number}){
 const db=await pool.connect();
 try{
 await db.query('BEGIN');
 const result=await db.query(`SELECT ${columns} FROM foundation_customers c WHERE c.id=$1 AND c.workspace_id=$2 FOR UPDATE OF c`,[id,principal.workspaceId]);
 const customer=result.rows[0];if(!customer)throw new CustomerError(404,'CUSTOMER_NOT_FOUND');
 assertCustomerAction(principal,customer,'customer.update');
 if(customer.ownerVersion!==command.expectedOwnerVersion)throw new CustomerError(409,'OWNER_VERSION_CONFLICT');
 await db.query('UPDATE foundation_customers SET display_name=$1,revision=revision+1,updated_at=now() WHERE id=$2',[command.displayName,id]);
 const eventId=randomUUID();
 await db.query('INSERT INTO foundation_events(id,customer_id,workspace_id,actor_user_id,action,owner_version,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[eventId,id,principal.workspaceId,principal.userId,'customer.update',customer.ownerVersion,JSON.stringify({displayName:command.displayName})]);
 await db.query('INSERT INTO foundation_outbox(id,customer_id) VALUES($1,$2)',[eventId,id]);
 await db.query('COMMIT');return {id,displayName:command.displayName,ownerVersion:customer.ownerVersion,projectionPending:true};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
// Serialize consumers with customer commands. Read latest authoritative snapshot while locked;
// replaying an older outbox event cannot overwrite a newer projection.
export async function flushProjection(){
 const db=await pool.connect();
 try{await db.query('BEGIN');
 const result=await db.query(`SELECT c.* FROM foundation_customers c WHERE EXISTS(SELECT 1 FROM foundation_outbox o WHERE o.customer_id=c.id AND o.delivered_at IS NULL) ORDER BY c.id LIMIT 1 FOR UPDATE OF c SKIP LOCKED`);
 const row=result.rows[0];if(!row){await db.query('COMMIT');return;}
 const key=process.env.TWENTY_PROJECTION_SERVICE_KEY;if(!key)throw Error('PROJECTION_CONFIGURATION_MISSING');
 const r=await fetch('http://127.0.0.1:3100/rest/foundationCustomers/'+row.id,{method:'PATCH',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({name:row.display_name,ownerUserId:row.owner_user_id,ownerVersion:row.owner_version}),signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!r.ok)throw Error('PROJECTION_UPSTREAM_REJECTED');
 await db.query('UPDATE foundation_outbox SET delivered_at=now(),last_error=NULL,attempts=attempts+1 WHERE customer_id=$1 AND delivered_at IS NULL',[row.id]);await db.query('COMMIT');
 }catch{await db.query('ROLLBACK');/* Durable rows remain pending; no business transaction replay. */}finally{db.release();}
}
