import {execFileSync} from 'node:child_process';
// Read only: never signal a PID obtained from a service label or a port scan.
/** @param {{pid: number, command: string, port?: number}} spec */
export function assertServiceProcess({pid,command,port=undefined}) {
 if(!Number.isSafeInteger(pid) || pid<1)throw new Error('Service has no live PID');
 process.kill(pid,0);
 const actual=execFileSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 if(actual!==command)throw new Error('Service process identity mismatch');
 if(port!==undefined){
  const listeners=execFileSync('lsof',['-nP','-a','-p',String(pid),`-iTCP:${port}`,'-sTCP:LISTEN','-t'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n');
  if(!listeners.includes(String(pid)))throw new Error('Expected service does not own its listener');
 }
}
export function assertLaunchedService({domain,label,...spec}) {
 const state=execFileSync('launchctl',['print',`${domain}/${label}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
 const pid=Number(state.match(/^\s*pid = (\d+)$/m)?.[1]);
 assertServiceProcess({...spec,pid});
 return pid;
}
