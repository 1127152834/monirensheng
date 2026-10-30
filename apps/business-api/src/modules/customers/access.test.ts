import {describe,it,expect} from 'vitest';
import {assertCustomerAction} from './access.js';
const a={userId:'a',workspaceId:'w',isBusinessAdmin:false,permissions:['customer.update','customer.reassign']};
const customer={id:'x',ownerUserId:'a',ownerVersion:1};
describe('authoritative customer access',()=>{
 it('allows owner update',()=>expect(()=>assertCustomerAction(a,customer,'customer.update')).not.toThrow());
 it('rejects another employee',()=>expect(()=>assertCustomerAction({...a,userId:'b'},customer,'customer.update')).toThrow());
 it('allows admin with feature permission',()=>expect(()=>assertCustomerAction({...a,userId:'m',isBusinessAdmin:true},customer,'customer.update')).not.toThrow());
 it('rejects staff reassignment even with permission',()=>expect(()=>assertCustomerAction(a,customer,'customer.reassign')).toThrow());
 it('requires feature permission for owners and admins',()=>{for(const isBusinessAdmin of [true,false])expect(()=>assertCustomerAction({...a,isBusinessAdmin,permissions:[]},customer,'customer.update')).toThrow();});
 it('fails closed for undefined allocation policy',()=>expect(()=>assertCustomerAction({...a,isBusinessAdmin:true},{...customer,ownerUserId:null},'customer.update')).toThrow());
});
