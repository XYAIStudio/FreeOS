import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import { useThemeStore } from "./stores/theme";
import { OpenModuleKey, useOpenModules } from "./open-modules";
import OpenSidebar from "./components/OpenSidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AuthPage from "./pages/AuthPage";
import OpenHomePage from "./pages/OpenHomePage";
import UserAgreementPage from "./pages/UserAgreementPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import { useLocale } from "./i18n";

const Dashboard=lazy(()=>import("./pages/OpenDashboard")),AnnouncementPage=lazy(()=>import("./pages/AnnouncementPage")),OrgChart=lazy(()=>import("./pages/OrgChart")),EmployeesPage=lazy(()=>import("./pages/EmployeesPage")),EmployeeDetailPage=lazy(()=>import("./pages/EmployeeDetailPage")),SkillsPage=lazy(()=>import("./pages/SkillsPage")),ChatPage=lazy(()=>import("./pages/ChatPage")),AgentStudioPage=lazy(()=>import("./pages/AgentStudioPage")),TasksPage=lazy(()=>import("./pages/TasksPage")),TaskDetailPage=lazy(()=>import("./pages/TaskDetailPage")),KnowledgePage=lazy(()=>import("./pages/KnowledgePage")),ReflectionPage=lazy(()=>import("./pages/ReflectionPage")),GovernancePage=lazy(()=>import("./pages/GovernancePage")),SettingsPage=lazy(()=>import("./pages/SettingsPage"));
const MODULE_ROUTES:Array<{prefix:string;key:OpenModuleKey}>=[["/announcements","announcements"],["/org","organization"],["/employees","employees"],["/skills","skills"],["/chat","chat"],["/agents","agents"],["/tasks","tasks"],["/knowledge","knowledge"],["/reflections","reflections"],["/governance","governance"],["/settings","settings"]].map(([prefix,key])=>({prefix,key:key as OpenModuleKey}));
const moduleFor=(path:string)=>MODULE_ROUTES.find(item=>path===item.prefix||path.startsWith(item.prefix+"/"))?.key;
function Loading(){const { t }=useLocale();return <div className="h-40 grid place-items-center text-text-muted animate-pulse">{t("加载中…", "Loading…")}</div>}

export default function OpenApp(){
 const {user,token,loading,init}=useAuthStore(),{init:initTheme}=useThemeStore(),modules=useOpenModules(s=>s.modules),moduleTenantId=useOpenModules(s=>s.tenantId),moduleError=useOpenModules(s=>s.error),loadModules=useOpenModules(s=>s.load),resetModules=useOpenModules(s=>s.reset),location=useLocation();
 const { t }=useLocale();
 const [collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{init();initTheme()},[init,initTheme]);useEffect(()=>{if(user&&token)void loadModules();else resetModules()},[user?.tenant_id,token,loadModules,resetModules]);
 const publicPath=["/","/auth","/user-agreement","/privacy-policy"].includes(location.pathname);
 if(publicPath)return <Routes><Route path="/" element={<OpenHomePage/>}/><Route path="/auth" element={<AuthPage/>}/><Route path="/user-agreement" element={<UserAgreementPage/>}/><Route path="/privacy-policy" element={<PrivacyPolicyPage/>}/></Routes>;
 if(loading||(user&&!moduleError&&moduleTenantId!==user.tenant_id))return <div className="h-screen grid place-items-center bg-bg text-text-muted">{t("加载中…", "Loading…")}</div>;
 if(user&&moduleError)return <div className="h-screen grid place-items-center bg-bg"><div className="text-center"><p>{t("模块配置加载失败", "Unable to load module configuration")}</p><p className="text-xs text-danger my-3">{moduleError}</p><button onClick={()=>void loadModules()} className="px-4 py-2 bg-primary text-white rounded">{t("重新加载", "Reload")}</button></div></div>;
 if(!user)return <Navigate to="/" replace/>;
 const needed=moduleFor(location.pathname);if(needed&&!modules[needed])return <Navigate to="/" replace/>;const isAdmin=user.role==="admin"||user.role==="super_admin";
 return <div className="flex h-screen overflow-hidden"><>{mobileOpen&&<div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={()=>setMobileOpen(false)}/>}</><OpenSidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={()=>setCollapsed(!collapsed)} onMobileClose={()=>setMobileOpen(false)}/><div className="flex-1 flex flex-col min-w-0"><Header onMobileMenuToggle={()=>setMobileOpen(!mobileOpen)}/><main className="flex-1 overflow-auto bg-bg"><Suspense fallback={<Loading/>}><Routes>
  <Route path="/app" element={<Dashboard/>}/><Route path="/announcements" element={<AnnouncementPage/>}/><Route path="/org" element={<OrgChart/>}/><Route path="/employees" element={<EmployeesPage/>}/><Route path="/employees/:id" element={<EmployeeDetailPage/>}/><Route path="/skills" element={<SkillsPage/>}/><Route path="/chat" element={<ChatPage/>}/><Route path="/agents" element={<AgentStudioPage/>}/><Route path="/tasks" element={<TasksPage/>}/><Route path="/tasks/:id" element={<TaskDetailPage/>}/><Route path="/knowledge" element={<KnowledgePage/>}/><Route path="/reflections" element={<ReflectionPage/>}/><Route path="/governance" element={isAdmin?<GovernancePage/>:<Navigate to="/" replace/>}/><Route path="/settings" element={isAdmin?<SettingsPage/>:<Navigate to="/" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></Suspense></main><Footer/></div></div>;
}
