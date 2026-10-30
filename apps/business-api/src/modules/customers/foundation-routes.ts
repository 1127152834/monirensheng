import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {resolvePrincipal,UnauthorizedError} from '../../auth/resolve-principal.js';
import {CustomerError} from './access.js';
import {listCustomers,updateCustomer} from './store.js';
export function parseCustomerPatch(body:unknown):{displayName:string;expectedOwnerVersion:number}{
 if(!body||typeof body!=='object'||Array.isArray(body))throw new CustomerError(400,'INVALID_COMMAND');
 const b=body as Record<string,unknown>;
 if(Object.keys(b).sort().join(',')!=='displayName,expectedOwnerVersion'||typeof b.displayName!=='string'||!b.displayName.trim()||b.displayName.trim().length>120||!Number.isSafeInteger(b.expectedOwnerVersion)||(b.expectedOwnerVersion as number)<1)throw new CustomerError(400,'INVALID_COMMAND');
 return {displayName:b.displayName.trim(),expectedOwnerVersion:b.expectedOwnerVersion as number};
}
export const foundationRoutes=new Hono();
foundationRoutes.use('*',cors({origin:'*',allowHeaders:['Authorization','Content-Type'],allowMethods:['GET','PATCH','OPTIONS'],credentials:false,maxAge:0}));
foundationRoutes.onError((e,c)=>{
 if(e instanceof UnauthorizedError)return c.json({error:'UNAUTHORIZED'},401);
 if(e instanceof CustomerError)return c.json({error:e.code},e.status);
 return c.json({error:'REQUEST_FAILED'},500);
});
foundationRoutes.get('/customers',async c=>c.json({customers:await listCustomers(await resolvePrincipal(c.req.raw))}));
foundationRoutes.patch('/customers/:id',async c=>{
 const principal=await resolvePrincipal(c.req.raw);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.req.param('id')))throw new CustomerError(400,'INVALID_CUSTOMER_ID');
 let body;try{body=await c.req.json();}catch{throw new CustomerError(400,'INVALID_COMMAND');}
 return c.json({customer:await updateCustomer(principal,c.req.param('id'),parseCustomerPatch(body))});
});
