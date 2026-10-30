import {it,expect} from 'vitest';
import {app} from '../../apps/business-api/src/app.js';
it('reports only isolated development service identity',async()=>{const response=await app.request('/health');expect(response.status).toBe(200);expect(await response.json()).toEqual({status:'ok',service:'company-helper-business-api',environment:'development',isolationId:'company-helper-crm-dev'});});
