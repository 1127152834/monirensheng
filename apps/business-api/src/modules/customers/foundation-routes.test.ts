import {it,expect} from 'vitest';
import {parseCustomerPatch} from './foundation-routes.js';
it('rejects mass assignment, coercion and invalid versions',()=>{
 for(const body of [{displayName:'x',expectedOwnerVersion:1,ownerUserId:'b'},{displayName:'x',expectedOwnerVersion:1,isBusinessAdmin:true},{displayName:'x',expectedOwnerVersion:'1'},{displayName:' ',expectedOwnerVersion:1},{displayName:'x',expectedOwnerVersion:0},null])expect(()=>parseCustomerPatch(body)).toThrow();
});
it('accepts only the explicit display name command',()=>expect(parseCustomerPatch({displayName:' Synthetic ',expectedOwnerVersion:1})).toEqual({displayName:'Synthetic',expectedOwnerVersion:1}));
