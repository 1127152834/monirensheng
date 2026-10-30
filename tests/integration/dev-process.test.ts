import {it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {assertServiceProcess} from '../../scripts/dev-process.mjs';
it('accepts the expected live process and rejects wrong identity or listener ownership',async()=>{
 const code="require('node:net').createServer().listen(0,'127.0.0.1',function(){console.log(this.address().port)})";
 const args=['-e',code];
 const child=spawn(process.execPath,args,{stdio:['ignore','pipe','inherit']});
 try {
  const [data]=await once(child.stdout!,'data');const port=Number(String(data).trim());
  const command=[process.execPath,...args].join(' ');
  expect(()=>assertServiceProcess({pid:child.pid!,command,port})).not.toThrow();
  expect(()=>assertServiceProcess({pid:child.pid!,command:'unrelated process',port})).toThrow();
  expect(()=>assertServiceProcess({pid:child.pid!,command,port:port===65535?65534:port+1})).toThrow();
 } finally {child.kill();await once(child,'exit');}
});
it('rejects a process that already exited',()=>expect(()=>assertServiceProcess({pid:2147483647,command:'missing'})).toThrow());
