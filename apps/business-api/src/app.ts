import {foundationRoutes} from './modules/customers/foundation-routes.js';
import { Hono } from 'hono';
export const app = new Hono();
app.get('/health',c=>c.json({status:'ok',service:'company-helper-business-api',environment:'development',isolationId:'company-helper-crm-dev'}));

app.route('/api/foundation',foundationRoutes);
