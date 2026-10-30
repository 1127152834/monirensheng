import net from 'node:net';
export async function runPreflight(config, {checkPorts=false}={}) {
 const checks=[];
 const check=(name,ok,message)=>checks.push({name,ok,message});
 check('environment',config.environment==='development','development required');
 check('isolation',config.isolationId==='company-helper-crm-dev','explicit isolation ID required');
 check('application ports',config.twentyPort===3100 && config.businessApiPort===8788,'only isolated ports 3100/8788 allowed');
 for (const [name,value,protocol,port,path] of [
 ['twenty database',config.twentyDatabaseUrl,'postgres:',15432,'/company_helper_twenty_dev'],
 ['business database',config.businessDatabaseUrl,'postgres:',15432,'/company_helper_business_dev'],
 ['redis',config.redisUrl,'redis:',16379,'/0']]) {
  let ok=false;try{const u=new URL(value);ok=u.protocol===protocol&&u.hostname==='127.0.0.1'&&Number(u.port)===port&&u.pathname===path&&!u.search&&!u.hash;}catch{}
  check(name,ok,'isolated loopback target required');
 }
 if(checkPorts && checks.every(c=>c.ok)) for(const port of [3100,8788,15432,16379]) {
  const results=[];
  for(const host of ['127.0.0.1','::1','0.0.0.0','::'])results.push(await new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen({port,host,ipv6Only:host.includes(':')},()=>s.close(()=>resolve(true)));}));
  const free=results.every(Boolean);
  check(`port ${port}`,free,'must be free; no process is terminated');
 }
 return {ok:checks.every(c=>c.ok),checks};
}
