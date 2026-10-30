import {flushProjection} from './modules/customers/store.js';
import {serve} from '@hono/node-server';
import {app} from './app.js';
serve({fetch:app.fetch,hostname:'127.0.0.1',port:8788});

let projecting=false;setInterval(()=>{if(projecting)return;projecting=true;void flushProjection().finally(()=>{projecting=false;});},2000).unref();
