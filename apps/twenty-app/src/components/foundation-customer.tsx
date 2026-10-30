import {defineFrontComponent} from 'twenty-sdk/define';
import {useEffect,useState} from 'react';
import type {RequestAccessTokenRefreshFunction} from 'twenty-sdk/front-component';
import {MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER} from 'src/constants/universal-identifiers';
type Customer={id:string;displayName:string;ownerUserId:string;ownerVersion:number;canUpdate:boolean;projectionPending:boolean};
let refreshed:string|undefined;
async function request(path:string,options:RequestInit={},retry=true):Promise<any>{
 const token=refreshed??process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN;
 if(!token)throw Error('用户应用身份不可用，请重新打开页面');
 const r=await fetch('http://127.0.0.1:8788/api/foundation'+path,{...options,credentials:'omit',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
 if(r.status===401&&retry){const refresh=(globalThis as any).frontComponentHostCommunicationApi?.requestAccessTokenRefresh as RequestAccessTokenRefreshFunction|undefined;if(refresh){refreshed=await refresh();return request(path,options,false);}}
 const result=await r.json();if(!r.ok)throw Error(result.error??'请求失败');return result;
}
function FoundationCustomer(){
 const [rows,setRows]=useState<Customer[]>([]),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){try{const data=await request('/customers');setRows(data.customers);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 async function save(row:Customer){try{await request('/customers/'+row.id,{method:'PATCH',body:JSON.stringify({displayName:row.displayName,expectedOwnerVersion:row.ownerVersion})});setMessage('已保存');await load();}catch(e){setError((e as Error).message);}}
 return <div style={{padding:24,fontFamily:'sans-serif',maxWidth:900}}><h1>客户办理验证</h1><p>合成数据 · 负责人或管理员可更新显示名</p><button onClick={()=>void load()}>刷新客户</button>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{rows.map(row=><section key={row.id} style={{border:'1px solid #ddd',padding:16,marginTop:16}}><h2>{row.displayName}</h2><p>负责人：{row.ownerUserId} · 版本：{row.ownerVersion}</p><p>{row.projectionPending?'摘要同步待重试':'摘要已同步'}</p><label>显示名<input aria-label={'显示名 '+row.id} value={row.displayName} disabled={!row.canUpdate} onChange={e=>setRows(rows.map(x=>x.id===row.id?{...x,displayName:e.target.value}:x))}/></label>{row.canUpdate?<button onClick={()=>void save(row)}>保存 {row.id}</button>:<p>只读：当前客户由其他员工负责</p>}</section>)}</div>;
}
export default defineFrontComponent({universalIdentifier:MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,name:'客户办理验证',description:'合成客户受控更新',component:FoundationCustomer});
