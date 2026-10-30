import type {Principal} from '../../../../../packages/contracts/src/identity.js';
export type CustomerAccess={id:string;ownerUserId:string|null;ownerVersion:number};
export type BusinessAction='customer.update'|'customer.reassign';
export class CustomerError extends Error {constructor(public status:400|403|404|409,public code:string){super(code);}}
export function assertCustomerAction(principal:Principal,customer:CustomerAccess,action:BusinessAction):void {
 if(!customer.ownerUserId)throw new CustomerError(409,'ALLOCATION_POLICY_REQUIRED');
 if(!principal.permissions.includes(action))throw new CustomerError(403,'FEATURE_PERMISSION_REQUIRED');
 if(action==='customer.reassign'?!principal.isBusinessAdmin:!principal.isBusinessAdmin&&principal.userId!==customer.ownerUserId)throw new CustomerError(403,'CUSTOMER_ACTION_FORBIDDEN');
}
