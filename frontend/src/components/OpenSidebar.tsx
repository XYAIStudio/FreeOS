import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Bot, Brain, Building2, ChevronLeft, LayoutDashboard, ListTodo, MessageSquare, Package, Settings, Shield, Users, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { OpenModuleKey, useOpenModules } from "../open-modules";
import { useLocale } from "../i18n";

const NAV: Array<{path:string;key:OpenModuleKey;icon:LucideIcon;admin?:boolean}> = [
  {path:"/app",key:"workspace",icon:LayoutDashboard},{path:"/announcements",key:"announcements",icon:Bell},
  {path:"/org",key:"organization",icon:Building2},{path:"/employees",key:"employees",icon:Users},
  {path:"/skills",key:"skills",icon:Package},{path:"/chat",key:"chat",icon:MessageSquare},
  {path:"/agents",key:"agents",icon:Bot},{path:"/tasks",key:"tasks",icon:ListTodo},
  {path:"/knowledge",key:"knowledge",icon:BookOpen},{path:"/reflections",key:"reflections",icon:Brain},
];
const EN_MODULE_LABELS: Record<OpenModuleKey, string> = { workspace: "Workspace", announcements: "Announcements", organization: "Organization", employees: "Human–AI resources", skills: "Skills & plugins", chat: "Collaboration", agents: "Agent Studio", tasks: "Tasks", knowledge: "Knowledge base", reflections: "Reflection engine", governance: "Governance engine", settings: "System settings" };

const BOTTOM: Array<{path:string;key:OpenModuleKey;icon:LucideIcon;admin?:boolean}> = [
  {path:"/governance",key:"governance",icon:Shield,admin:true},{path:"/settings",key:"settings",icon:Settings,admin:true},
];
export default function OpenSidebar({collapsed,mobileOpen,onToggle,onMobileClose}:{collapsed:boolean;mobileOpen:boolean;onToggle:()=>void;onMobileClose:()=>void}){
  const navigate=useNavigate(),location=useLocation(),{user,logout}=useAuthStore(),modules=useOpenModules(s=>s.modules),labels=useOpenModules(s=>s.labels);
  const { isEnglish } = useLocale();
  const isAdmin=user?.role==="admin"||user?.role==="super_admin";const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{const resize=()=>setIsMobile(innerWidth<768);resize();addEventListener("resize",resize);return()=>removeEventListener("resize",resize)},[]);
  const showText=!collapsed||isMobile,go=(path:string)=>{navigate(path);if(innerWidth<768)onMobileClose()};
  const render=(items:typeof NAV)=>items.map(item=>{if(!modules[item.key]||(item.admin&&!isAdmin))return null;const active=item.path==="/"?location.pathname==="/":location.pathname===item.path||location.pathname.startsWith(item.path+"/");return <button key={item.key} onClick={()=>go(item.path)} title={collapsed ? (isEnglish ? EN_MODULE_LABELS[item.key] : labels[item.key]) : undefined} className={`w-full flex items-center ${collapsed?"justify-center px-2":"gap-3 px-3"} py-2 rounded text-sm transition-all ${active?"bg-primary text-white shadow-sm":"text-text-muted hover:bg-bg hover:text-text"}`}><item.icon size={16}/>{showText&&<span>{isEnglish ? EN_MODULE_LABELS[item.key] : labels[item.key]}</span>}</button>});
  const content=<aside className={`relative flex flex-col ${collapsed?"w-56 md:w-16":"w-56"} h-screen bg-bg-card border-r border-border transition-all`}>
    <button onClick={onToggle} className="hidden md:flex absolute top-1/2 -right-3 z-20 w-6 h-6 rounded-full bg-bg-card border border-border items-center justify-center"><ChevronLeft size={12} className={collapsed?"rotate-180":""}/></button>
    <div className={`flex items-center ${collapsed?"justify-center px-2":"gap-3 px-4"} py-3 border-b border-border`}><div className="w-10 h-10 rounded bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-bold">OX</div>{showText&&<div><h1 className="font-bold">open<span className="text-primary">XYOS</span></h1><p className="text-[10px] text-text-muted">{isEnglish ? "community edition" : "社区版"}</p></div>}</div>
    <nav className="flex-1 py-3 px-2 space-y-1 overflow-auto">{render(NAV)}</nav><div className="px-2 pb-3 space-y-1">{render(BOTTOM)}</div>
    {user&&<div className="p-3 border-t border-border"><div className={`flex items-center ${collapsed?"justify-center":"gap-2"}`}><div className="w-8 h-8 rounded bg-primary text-white grid place-items-center text-xs">{user.nickname?.[0]||"U"}</div>{showText&&<><div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{user.nickname}</p><p className="text-[10px] text-text-muted">{isAdmin ? (isEnglish ? "Administrator" : "管理员") : (isEnglish ? "User" : "用户")}</p></div><button onClick={logout} className="text-text-muted hover:text-danger">⏻</button></>}</div></div>}
  </aside>;
  return <><div className={`md:hidden fixed inset-y-0 left-0 z-50 transition-transform ${mobileOpen?"translate-x-0":"-translate-x-full"}`}>{content}</div><div className="hidden md:block">{content}</div></>;
}
