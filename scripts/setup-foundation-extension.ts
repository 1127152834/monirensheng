import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {loadFixture,login,gql,base} from './foundation-client.mjs';
import {FOUNDATION_SCHEMA_SQL} from '../apps/business-api/src/db/schema/foundation-customers.js';
const f=await loadFixture();const token=await login(f.admin,base);
const secrets=Object.fromEntries((await readFile('.local/dev.env','utf8')).trim().split('\n').map(x=>{const n=x.indexOf('=');return [x.slice(0,n),x.slice(n+1)];}));
const objects=(await gql('{objects(paging:{first:1000}){edges{node{id nameSingular}}}}',{},token)).objects.edges.map((e:any)=>e.node);
const object=objects.find((o:any)=>o.nameSingular==='foundationCustomer');if(!object)throw Error('Install app first');
await gql('mutation($input:UpsertObjectPermissionsInput!){upsertObjectPermissions(upsertObjectPermissionsInput:$input){objectMetadataId}}',{input:{roleId:f.staffRole.id,objectPermissions:[f.object.id,object.id].map(objectMetadataId=>({objectMetadataId,canReadObjectRecords:true,canUpdateObjectRecords:false,canSoftDeleteObjectRecords:false,canDestroyObjectRecords:false}))}},token);
let extension:any;try{extension=JSON.parse(await readFile('.local/foundation-extension.json','utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}
if(!extension){
 const roles=(await gql('{getRoles{id label}}',{},token)).getRoles;
 const role=roles.find((r:any)=>r.label==='M0 Projection Backend Only')??(await gql('mutation($input:CreateRoleInput!){createOneRole(createRoleInput:$input){id}}',{input:{label:'M0 Projection Backend Only',canBeAssignedToUsers:false,canBeAssignedToAgents:false,canBeAssignedToApiKeys:true,canUpdateAllSettings:false,canAccessAllTools:false,canAccessAllAgentChatChannels:false,canReadAllObjectRecords:false,canUpdateAllObjectRecords:false,canSoftDeleteAllObjectRecords:false,canDestroyAllObjectRecords:false}},token)).createOneRole;
 await gql('mutation($input:UpsertObjectPermissionsInput!){upsertObjectPermissions(upsertObjectPermissionsInput:$input){objectMetadataId}}',{input:{roleId:role.id,objectPermissions:[{objectMetadataId:object.id,canReadObjectRecords:true,canUpdateObjectRecords:true,canSoftDeleteObjectRecords:false,canDestroyObjectRecords:false}]}},token);
 const expiresAt=new Date(Date.now()+30*86400000).toISOString();
 const keys=(await gql('{apiKeys{id name}}',{},token)).apiKeys;
 const key=keys.find((k:any)=>k.name==='M0 isolated projection writer')??(await gql('mutation($input:CreateApiKeyInput!){createApiKey(input:$input){id}}',{input:{name:'M0 isolated projection writer',roleId:role.id,expiresAt}},token)).createApiKey;
 const keyResult=await gql('mutation($id:UUID!,$expires:String!){generateApiKeyToken(apiKeyId:$id,expiresAt:$expires){token}}',{id:key.id,expires:expiresAt},token);
 extension={objectId:object.id,serviceRoleId:role.id,serviceKeyId:key.id,serviceKey:keyResult.generateApiKeyToken.token,customers:[{id:randomUUID(),displayName:'合成客户 X',ownerUserId:f.a.identity.id},{id:randomUUID(),displayName:'合成客户 Y',ownerUserId:f.b.identity.id}]};
 await writeFile('.local/foundation-extension.json',JSON.stringify(extension),{mode:0o600,flag:'wx'});
}
if(typeof extension.serviceKey!=='string')throw Error('Unexpected API key token shape');
const pool=new Pool({connectionString:secrets.BUSINESS_DATABASE_URL});
try{await pool.query(FOUNDATION_SCHEMA_SQL);
for(const customer of extension.customers){
 await pool.query('INSERT INTO foundation_customers(id,workspace_id,display_name,owner_user_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[customer.id,f.workspaceId,customer.displayName,customer.ownerUserId]);
 const existing=await fetch(base+'/rest/foundationCustomers/'+customer.id,{headers:{Authorization:`Bearer ${extension.serviceKey}`}});
 if(existing.status===404){const r=await fetch(base+'/rest/foundationCustomers',{method:'POST',headers:{Authorization:`Bearer ${extension.serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({id:customer.id,name:customer.displayName,ownerUserId:customer.ownerUserId,ownerVersion:1})});if(!r.ok)throw Error('Projection seed failed '+r.status);}
 else if(!existing.ok)throw Error('Projection read failed '+existing.status);
}
}finally{await pool.end();}
const runtime={NODE_ENV:'development',BUSINESS_DATABASE_URL:secrets.BUSINESS_DATABASE_URL,TWENTY_WORKSPACE_ID:f.workspaceId,TWENTY_BUSINESS_ADMIN_ROLE_IDS:f.admin.identity.workspaceMember.roles.map((r:any)=>r.id).join(','),TWENTY_BUSINESS_STAFF_ROLE_IDS:f.staffRole.id,TWENTY_PROJECTION_SERVICE_KEY:extension.serviceKey};
await writeFile('.local/business-api.env',Object.entries(runtime).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
console.log('Projection grant, restricted backend key, authoritative synthetic customers and isolated API configuration ready.');
