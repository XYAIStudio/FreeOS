import { create } from "zustand";
import { authFetch } from "./api/authFetch";
export const OPEN_MODULE_KEYS = ["workspace","announcements","organization","employees","skills","chat","agents","tasks","knowledge","reflections","governance","settings"] as const;
export type OpenModuleKey = typeof OPEN_MODULE_KEYS[number];
const defaults = Object.fromEntries(OPEN_MODULE_KEYS.map(key => [key,true])) as Record<OpenModuleKey,boolean>;
const defaultLabels: Record<OpenModuleKey,string> = { workspace:"工作台",announcements:"通知公告",organization:"组织架构",employees:"人机资源",skills:"技能插件",chat:"沟通协作",agents:"智能体定制",tasks:"任务管理",knowledge:"知识库",reflections:"反思引擎",governance:"治理引擎",settings:"系统设置" };
let latestLoadId = 0;
export interface OpenModuleSetting { key:OpenModuleKey;label:string;defaultLabel:string;description:string;enabled:boolean;locked:boolean }
interface State { modules:Record<OpenModuleKey,boolean>;labels:Record<OpenModuleKey,string>;tenantId:number|null;loading:boolean;error:string|null;load:()=>Promise<void>;reset:()=>void }
export const useOpenModules=create<State>(set=>({modules:{...defaults},labels:{...defaultLabels},tenantId:null,loading:false,error:null,
 load:async()=>{const loadId=++latestLoadId;set({loading:true,error:null});try{const response=await authFetch("/api/module-settings"),result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||"模块配置加载失败");const modules={...defaults},labels={...defaultLabels};for(const item of result.data.modules as OpenModuleSetting[]){modules[item.key]=item.enabled;labels[item.key]=item.label}if(loadId===latestLoadId)set({modules,labels,tenantId:result.data.tenant.id,loading:false})}catch(error){if(loadId===latestLoadId)set({loading:false,error:error instanceof Error?error.message:"模块配置加载失败"})}},
 reset:()=>{latestLoadId++;set({modules:{...defaults},labels:{...defaultLabels},tenantId:null,loading:false,error:null})}
}));
