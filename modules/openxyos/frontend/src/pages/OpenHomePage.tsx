import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Blocks, Bot, Braces, Building2, Check, ChevronDown, CircleDot, Code2, Copy, Eye, EyeOff, GitBranch, Github, KeyRound, Layers3, LockKeyhole, Menu, MessageSquareMore, Network, Play, ShieldCheck, Sparkles, Terminal, Users, X } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { authFetch } from "../api/authFetch";
import { EXPERIENCE_MODELS, type ExperienceModelId } from "../llm-providers";
import "../openxyos.css";
import AgentJourneyDemo from "../components/AgentJourneyDemo";
import { LanguageToggle, useLocale } from "../i18n";
import { XYAI_MASCOT_SRC } from "../brandAssets";
import HeroWaterScene from "../components/HeroWaterScene";

const GITHUB_URL = (import.meta.env.VITE_GITHUB_URL as string | undefined)?.trim() || "https://github.com/XYAIStudio/openXYOS";
const CAPABILITIES = [
  { icon: Building2, title: ["集团多层级组织", "Multi-level organizations"], text: ["集团、公司、部门、岗位与人员关系统一建模，支持复杂组织的分层协作。", "Model groups, companies, departments, roles, and people in one hierarchy for complex collaboration."] },
  { icon: Layers3, title: ["多租户与多模块", "Multi-tenant, modular"], text: ["租户数据隔离，管理员可按租户启停模块并编辑模块显示名称。", "Isolate tenant data and let administrators enable modules and rename them per tenant."] },
  { icon: ShieldCheck, title: ["人机共融共治", "Human-AI co-governance"], text: ["支持人机协作、人工确认与审计留痕，让组织协作保持透明可追溯。", "Combine human review, AI collaboration, and audit trails for transparent, traceable work."] },
  { icon: Bot, title: ["智能体定制", "Agent customization"], text: ["按岗位配置角色、模型、技能、知识与权限，让智能体成为可治理成员。", "Configure roles, models, skills, knowledge, and permissions so agents become governed members."] },
  { icon: MessageSquareMore, title: ["人机单聊与群聊", "Human-AI conversations"], text: ["人类与智能体进入同一会话，支持点对点沟通、多人群组与协同任务。", "Bring people and agents into direct messages, group conversations, and shared tasks."] },
  { icon: Blocks, title: ["可二次开发模块", "Extensible modules"], text: ["示例模块保留完整前后端链路，可修改数据、页面和流程并扩展新模块。", "Sample modules keep their full stack paths so teams can change data, pages, flows, and add modules."] },
];
const MODULES = [
  ["workspace", "工作台", "base"], ["announcements", "通知公告", "sample"],
  ["organization", "组织架构", "core"], ["people", "人机资源", "core"],
  ["skills", "技能插件", "core"], ["chat", "沟通协作", "core"],
  ["agents", "智能体定制", "core"], ["tasks", "任务管理", "sample"],
  ["knowledge", "知识库", "sample"], ["reflections", "反思引擎", "sample"],
  ["governance", "治理引擎", "core"], ["settings", "系统设置", "base"],
] as const;

function HeroNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, width = 0, height = 0, start = performance.now();
    const pointer = { x: .5, y: .5, active: false };
    const parallax = { x: 0, y: 0, angle: 0 };
    const palette = [
      { hue: 55, saturation: 92, lightness: 68 },
      { hue: 139, saturation: 78, lightness: 61 },
      { hue: 2, saturation: 86, lightness: 66 },
    ];
    const particles = Array.from({ length: 420 }, (_, index) => ({
      arm: index % 3,
      t: Math.random(),
      across: (Math.random() + Math.random() - 1),
      depth: .3 + Math.random() * .7,
      speed: .018 + Math.random() * .026,
      phase: Math.random() * Math.PI * 2,
      size: .32 + Math.random() * .78,
    }));
    const coreParticles = Array.from({ length: 86 }, () => ({
      t: Math.random(),
      across: Math.random() + Math.random() - 1,
      speed: .014 + Math.random() * .02,
      phase: Math.random() * Math.PI * 2,
      size: .35 + Math.random() * .72,
    }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointer.active = true;
    };
    const leave = () => { pointer.active = false; };
    const draw = (now = performance.now()) => {
      const time = reduced ? 0 : (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      const targetX = pointer.active ? (pointer.x - .5) * 42 : 0;
      const targetY = pointer.active ? (pointer.y - .5) * 28 : 0;
      const targetAngle = pointer.active ? (pointer.x - .5) * .075 : 0;
      parallax.x += (targetX - parallax.x) * .045;
      parallax.y += (targetY - parallax.y) * .045;
      parallax.angle += (targetAngle - parallax.angle) * .035;

      const baseX = width * .59 + parallax.x;
      const baseY = height * .41 + parallax.y;
      const scale = Math.min(width * .39, height * .43);
      const wash = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, scale * 1.45);
      wash.addColorStop(0, "rgba(40,156,190,.09)"); wash.addColorStop(.42, "rgba(61,214,161,.045)"); wash.addColorStop(1, "rgba(4,9,8,0)");
      ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(parallax.angle + time * .008);
      ctx.translate(-baseX, -baseY);

      for (let arm = 0; arm < 3; arm++) {
        const color = palette[arm];
        ctx.beginPath();
        for (let step = 0; step <= 72; step++) {
          const t = step / 72;
          const theta = arm * Math.PI * 2 / 3 - 1.28 + t * 2.02 + Math.sin(t * Math.PI) * .34;
          const radius = scale * (.09 + t * .89);
          const x = baseX + Math.cos(theta) * radius;
          const y = baseY + Math.sin(theta) * radius * .72;
          if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = `hsla(${color.hue},${color.saturation}%,${color.lightness}%,.075)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const p of particles) {
        const t = (p.t + time * p.speed) % 1;
        const theta = p.arm * Math.PI * 2 / 3 - 1.28 + t * 2.02 + Math.sin(t * Math.PI) * .34;
        const radius = scale * (.09 + t * .89);
        const thickness = scale * Math.pow(Math.sin(Math.PI * t), .72) * (.055 + p.depth * .045);
        const tangentAngle = theta + Math.PI / 2 + .34 * Math.cos(Math.PI * t);
        const flutter = Math.sin(time * .55 + p.phase) * 1.6;
        const px = baseX + Math.cos(theta) * radius + Math.cos(tangentAngle) * (p.across * thickness + flutter);
        const py = baseY + Math.sin(theta) * radius * .72 + Math.sin(tangentAngle) * (p.across * thickness + flutter) * .72;
        const color = palette[p.arm];
        const fade = Math.sin(Math.PI * Math.min(.98, t));
        ctx.beginPath(); ctx.arc(px, py, Math.min(1.22, p.size * (.72 + p.depth * .42)), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${color.hue},${color.saturation}%,${color.lightness}%,${.14 + fade * (.28 + p.depth * .25)})`;
        ctx.fill();
      }

      for (const p of coreParticles) {
        const t = (p.t + time * p.speed) % 1;
        const y = baseY + scale * (.18 - t * .44);
        const halfWidth = scale * .085 * Math.sin(Math.PI * t) + 2;
        const x = baseX + p.across * halfWidth + Math.sin(time * .7 + p.phase) * 1.2;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(218,92%,68%,${.2 + Math.sin(Math.PI * t) * .5})`;
        ctx.fill();
      }
      ctx.restore();
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    resize(); addEventListener("resize", resize); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerleave", leave); draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerleave", leave); };
  }, []);
  return <div className="ox-network" aria-hidden="true"><canvas ref={canvasRef}/><div className="ox-wave-haze"/></div>;
}

function HeroRippleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, width = 0, height = 0, start = performance.now();
    const pointer = { x: .5, y: .5, active: false };
    const field = { x: 0, y: 0, tilt: 0, lift: 0 };
    const rings = [.16, .29, .43, .59, .76];
    // Keep the motion language inside the landing-page blue spectrum. The
    // previous yellow/green/red lanes fought the light FreeOS canvas.
    const palette = ["49,94,251", "78,129,255", "79,174,255"];
    const motes = Array.from({ length: 420 }, (_, index) => ({
      ring: index % rings.length,
      angle: Math.random() * Math.PI * 2,
      speed: .018 + Math.random() * .05,
      radiusJitter: (Math.random() - .5) * .018,
      lift: Math.random() * 5,
      size: .24 + Math.random() * .7,
      phase: Math.random() * Math.PI * 2,
    }));
    const modules = Array.from({ length: 12 }, (_, index) => ({
      angle: -Math.PI * .92 + index * Math.PI * 2 / 12,
      phase: index * .57,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointer.active = true;
    };
    const leave = () => { pointer.active = false; };

    const strokeOrbit = (cx: number, cy: number, radius: number, time: number, alpha: number) => {
      ctx.beginPath();
      for (let step = 0; step <= 150; step++) {
        const a = step / 150 * Math.PI * 2;
        const pulse = 1 + Math.sin(a * 3 - time * .42 + radius) * .012;
        const x = cx + Math.cos(a + field.tilt) * radius * pulse;
        const y = cy + Math.sin(a + field.tilt) * radius * .245 * pulse;
        if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.shadowColor = "rgba(52,157,255,.9)";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = `rgba(35,115,255,${alpha * .32})`;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.shadowBlur = 7;
      ctx.strokeStyle = `rgba(92,222,255,${alpha})`;
      ctx.lineWidth = radius < 90 ? 1.25 : .78;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const draw = (now = performance.now()) => {
      const time = reduced ? 0 : (now - start) / 1000;
      const targetX = pointer.active ? (pointer.x - .5) * 56 : 0;
      const targetY = pointer.active ? (pointer.y - .5) * 28 : 0;
      const targetTilt = pointer.active ? (pointer.x - .5) * .075 : 0;
      field.x += (targetX - field.x) * .04;
      field.y += (targetY - field.y) * .04;
      field.tilt += (targetTilt - field.tilt) * .032;
      field.lift += ((pointer.active ? (.5 - pointer.y) * 8 : 0) - field.lift) * .035;

      ctx.clearRect(0, 0, width, height);
      const cx = width * .62 + field.x;
      const compact = height < 300;
      const cy = height * (compact ? .49 : .57) + field.y;
      const scale = compact ? width * .52 : Math.min(width * .59, height * .61);
      const squash = (compact ? .34 : .255) + field.lift * .0014;

      const sky = ctx.createLinearGradient(0, 0, 0, height * .74);
      sky.addColorStop(0, "rgba(49,94,251,.075)");
      sky.addColorStop(.42, "rgba(76,125,255,.052)");
      sky.addColorStop(.64, "rgba(107,181,255,.028)");
      sky.addColorStop(1, "rgba(245,248,255,0)");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height * .78);

      const horizon = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.2);
      horizon.addColorStop(0, "rgba(116,174,255,.14)");
      horizon.addColorStop(.22, "rgba(49,94,251,.075)");
      horizon.addColorStop(.58, "rgba(137,163,255,.028)");
      horizon.addColorStop(1, "rgba(245,248,255,0)");
      ctx.fillStyle = horizon; ctx.fillRect(0, cy - scale * .42, width, scale * .84);

      rings.forEach((factor, index) => strokeOrbit(cx, cy, scale * factor, time + index * .55, .2 + (1 - index / rings.length) * .43));

      // Three logo-derived arms become independent tenant lanes around one shared core.
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let step = 0; step <= 150; step++) {
          const t = step / 150;
          const a = arm * Math.PI * 2 / 3 + t * Math.PI * 2.2 + time * .055;
          const radius = scale * (.055 + t * .43);
          const x = cx + Math.cos(a + field.tilt) * radius;
          const y = cy + Math.sin(a + field.tilt) * radius * squash;
          if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.shadowColor = `rgba(${palette[arm]},.65)`;
        ctx.shadowBlur = 9;
        ctx.strokeStyle = `rgba(${palette[arm]},.42)`;
        ctx.lineWidth = .78;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Group -> tenant -> department constellation: one governed hierarchy, many isolated tenants.
      const tenantAngles = [-2.62, -1.52, -.38];
      tenantAngles.forEach((angle, tenant) => {
        const hubRadius = scale * .43;
        const hx = cx + Math.cos(angle + field.tilt) * hubRadius;
        const hy = cy + Math.sin(angle + field.tilt) * hubRadius * squash;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo((cx + hx) / 2, Math.min(cy, hy) - 25 - tenant * 6, hx, hy);
        ctx.strokeStyle = `rgba(${palette[tenant]},.26)`; ctx.lineWidth = .75; ctx.stroke();
        for (let child = 0; child < 3; child++) {
          const ca = angle + (child - 1) * .18;
          const cr = scale * (.57 + child * .045);
          const dx = cx + Math.cos(ca + field.tilt) * cr;
          const dy = cy + Math.sin(ca + field.tilt) * cr * squash;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(dx, dy);
          ctx.strokeStyle = `rgba(${palette[tenant]},.18)`; ctx.stroke();
          ctx.beginPath(); ctx.arc(dx, dy, 1.75, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${palette[tenant]},.72)`; ctx.fill();
        }
        ctx.shadowColor = `rgba(${palette[tenant]},.8)`; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(hx, hy, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${palette[tenant]},.92)`; ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = "600 8px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.letterSpacing = "1px";
        ctx.fillStyle = `rgba(${palette[tenant]},.62)`;
        ctx.textAlign = "center";
        ctx.fillText(`TENANT 0${tenant + 1}`, hx, hy - 11);
      });

      // Twelve detachable module cells orbit the organization and pulse into the shared platform.
      modules.forEach((module, index) => {
        const a = module.angle + field.tilt + Math.sin(time * .22 + module.phase) * .008;
        const radius = scale * .73;
        const mx = cx + Math.cos(a) * radius;
        const my = cy + Math.sin(a) * radius * squash;
        const pulse = .38 + Math.sin(time * .9 + module.phase) * .16;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(
          cx + Math.cos(a) * scale * .59,
          cy + Math.sin(a) * scale * .59 * squash,
        );
        ctx.strokeStyle = `rgba(92,207,255,${.08 + pulse * .12})`;
        ctx.lineWidth = .55; ctx.stroke();
        ctx.save(); ctx.translate(mx, my); ctx.rotate(a * .22);
        ctx.strokeStyle = `rgba(${index % 3 === 1 ? "74,239,174" : "91,202,255"},${pulse})`;
        ctx.fillStyle = "rgba(235,242,255,.88)"; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.roundRect(-4.5, -4.5, 9, 9, 1.8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(${index % 3 === 1 ? "74,239,174" : "91,202,255"},.7)`;
        ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
        ctx.restore();
      });

      for (const mote of motes) {
        const a = mote.angle + time * mote.speed * (mote.ring % 2 ? 1 : -1) + field.tilt;
        const radius = scale * (rings[mote.ring] + mote.radiusJitter + Math.sin(time * .5 + mote.phase) * .004);
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius * squash - mote.lift * (1 - mote.ring / rings.length);
        const twinkle = .35 + .65 * Math.abs(Math.sin(time * .72 + mote.phase));
        ctx.beginPath(); ctx.arc(px, py, Math.min(1.08, mote.size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${mote.ring % 4 === 0 ? "145,127,255" : "103,225,255"},${.1 + twinkle * .5})`;
        ctx.fill();
      }

      // Human and AI are two equal, interlocking sources—not a single central machine.
      const partners = [
        { x: cx - 13, color: "73,112,255" },
        { x: cx + 13, color: "91,179,255" },
      ];
      ctx.beginPath();
      for (let step = 0; step <= 120; step++) {
        const a = step / 120 * Math.PI * 2;
        const px = cx + Math.sin(a) * 27;
        const py = cy + Math.sin(a * 2) * 7.5;
        if (step) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.strokeStyle = "rgba(120,238,255,.6)"; ctx.lineWidth = 1; ctx.shadowColor = "rgba(58,207,255,.9)"; ctx.shadowBlur = 10; ctx.stroke();
      partners.forEach((partner, index) => {
        const breathing = 7 + Math.sin(time * 1.2 + index * Math.PI) * 1.1;
        const core = ctx.createRadialGradient(partner.x, cy, 0, partner.x, cy, 34);
        core.addColorStop(0, `rgba(${partner.color},.96)`);
        core.addColorStop(.13, `rgba(${partner.color},.5)`);
        core.addColorStop(.5, `rgba(${partner.color},.1)`);
        core.addColorStop(1, `rgba(${partner.color},0)`);
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(partner.x, cy, 34, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(partner.x, cy, breathing * .34, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${partner.color},.95)`; ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.font = "700 8px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.letterSpacing = "1.2px";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(49,94,251,.7)"; ctx.fillText("HUMAN", cx - 23, cy + 22);
      ctx.fillStyle = "rgba(68,148,255,.74)"; ctx.fillText("AI", cx + 24, cy + 22);
      ctx.font = "600 7px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillStyle = "rgba(129,190,209,.45)"; ctx.fillText("CO-GOVERNED CORE", cx, cy + 34);

      // AI-native data pulses continuously traverse the hierarchy paths.
      for (let stream = 0; stream < 9; stream++) {
        const tenant = stream % 3;
        const angle = tenantAngles[tenant];
        const progress = (time * (.09 + stream * .004) + stream / 9) % 1;
        const radius = scale * (.04 + progress * .55);
        const a = angle + Math.sin(progress * Math.PI) * .28 + field.tilt;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius * squash - Math.sin(progress * Math.PI) * 18;
        ctx.shadowColor = `rgba(${palette[tenant]},.9)`; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(px, py, .85, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${palette[tenant]},${.25 + Math.sin(progress * Math.PI) * .7})`; ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.font = "600 7px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.letterSpacing = "1px"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(96,211,239,.42)";
      ctx.fillText("12 COMPOSABLE MODULES  ·  AI-NATIVE DATA FLOW", cx, cy + scale * .76 * squash + 18);

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    resize(); addEventListener("resize", resize);
    canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerleave", leave); draw();
    return () => {
      cancelAnimationFrame(raf); removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <div className="ox-network ox-ripple-field" aria-hidden="true"><canvas ref={canvasRef}/><div className="ox-wave-haze"/></div>;
}

export default function OpenHomePage() {
  const { isEnglish } = useLocale();
  const tx = (zh: string, en: string) => isEnglish ? en : zh;
  const navigate = useNavigate(), { login } = useAuthStore();
  const [demoOpen, setDemoOpen] = useState(false), [demoPhase, setDemoPhase] = useState<"model" | "account">("model"), [loginState, setLoginState] = useState<"idle" | "admin" | "user">("idle"), [loginError, setLoginError] = useState(""), [copied, setCopied] = useState(false), [navOpen, setNavOpen] = useState(false);
  const [providerId, setProviderId] = useState<ExperienceModelId>("deepseek"), [apiKey, setApiKey] = useState(""), [showKey, setShowKey] = useState(false);
  const openDemo = (phase: "model" | "account") => {
    setDemoPhase(phase); setLoginError(""); setLoginState("idle"); setDemoOpen(true);
  };
  const enterDemo = async (kind: "admin" | "user") => {
    setLoginState(kind); setLoginError("");
    try { await login(kind === "admin" ? "demo@demo.com" : "user@demo.com", "openxyos-demo-2026"); navigate("/app"); }
    catch (error) { setLoginError(error instanceof Error ? error.message : tx("演示环境暂时不可用，请使用登录页进入。", "The demo is temporarily unavailable. Please use the sign-in page.")); setLoginState("idle"); }
  };
  const saveModelAndEnter = async () => {
    if (apiKey.trim().length < 8 || /\s/.test(apiKey.trim())) { setLoginError(tx("请输入有效的 API Key（不能包含空格）", "Enter a valid API key without spaces.")); return; }
    setLoginState("admin"); setLoginError("");
    try {
      await login("demo@demo.com", "openxyos-demo-2026");
      const response = await authFetch("/api/settings/ai/onboarding", {
        method: "PUT",
        body: JSON.stringify({ providerId, apiKey: apiKey.trim() }),
      });
      const body = await response.text();
      const result = body ? JSON.parse(body) : null;
      if (!response.ok || !result?.success) throw new Error(result?.error || tx("模型配置保存失败", "Unable to save model configuration."));
      setApiKey("");
      navigate("/app");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : tx("模型配置保存失败", "Unable to save model configuration."));
      setLoginState("idle");
    }
  };
  const copyInstall = async () => { await navigator.clipboard.writeText("npm ci && npm run dev"); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const closeNav = () => setNavOpen(false);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return <div className="ox-page">
    <nav className="ox-nav" aria-label={tx("主导航", "Primary navigation")}>
      <a className="ox-brand" href="#top" onClick={closeNav}><i><Network size={18}/></i><b>open<span>XYOS</span></b><em>community</em></a>
      <div className="ox-links ox-desktop-links"><a href="#capabilities">{tx("核心能力", "Capabilities")}</a><a href="#agent-flow">{tx("智能体流程", "Agent flow")}</a><a href="#architecture">{tx("架构", "Architecture")}</a><a href="#modules">{tx("模块", "Modules")}</a><a href="#contribute">{tx("共建", "Contribute")}</a></div>
      <div className="ox-nav-actions ox-desktop-actions"><LanguageToggle/><button onClick={() => navigate("/auth")}>{tx("登录 / 注册", "Sign in / Register")}</button><a href={GITHUB_URL || "#source"} target={GITHUB_URL ? "_blank" : undefined} rel="noreferrer"><Github size={16}/> {GITHUB_URL ? "GitHub" : "源码"}</a></div>
      <button className="ox-menu-toggle" type="button" onClick={() => setNavOpen(open => !open)} aria-expanded={navOpen} aria-controls="ox-mobile-nav" aria-label={navOpen ? tx("关闭导航", "Close navigation") : tx("打开导航", "Open navigation")}>{navOpen ? <X size={19}/> : <Menu size={20}/>}</button>
      <div id="ox-mobile-nav" className={"ox-mobile-menu" + (navOpen ? " is-open" : "")} aria-hidden={!navOpen}>
        <div className="ox-mobile-links"><a href="#capabilities" onClick={closeNav}>{tx("核心能力", "Capabilities")}</a><a href="#agent-flow" onClick={closeNav}>{tx("智能体流程", "Agent flow")}</a><a href="#architecture" onClick={closeNav}>{tx("架构", "Architecture")}</a><a href="#modules" onClick={closeNav}>{tx("模块", "Modules")}</a><a href="#contribute" onClick={closeNav}>{tx("共建", "Contribute")}</a></div>
        <div className="ox-mobile-actions"><LanguageToggle/><button onClick={() => { closeNav(); navigate("/auth"); }}>{tx("登录 / 注册", "Sign in / Register")}</button><a href={GITHUB_URL || "#source"} target={GITHUB_URL ? "_blank" : undefined} rel="noreferrer" onClick={closeNav}><Github size={16}/> {GITHUB_URL ? "GitHub" : "源码"}</a></div>
      </div>
    </nav>
    <main>
      <section id="top" className="ox-hero">
        <div className="ox-grid"/><div className="ox-glow one"/><div className="ox-glow two"/>
        <div className="ox-hero-copy">
          <div className="ox-pill"><CircleDot size={13}/> {tx("为组织智能化管理而生", "Built for intelligent organization management")}</div>
          <h1>{tx("为人机共融组织而生的", "The open-source OS for")}<br/><span>{tx("开源操作系统", "human–AI organizations")}</span></h1>
          <p>{tx("openXYOS 将集团组织、多租户、模块化应用与可治理智能体放进同一套开放底座，让开发者共同构建真正可协作、可扩展、可审计的人机组织。", "openXYOS brings group organizations, multi-tenancy, modular apps, and governed agents into one open foundation for collaborative, extensible, auditable organizations.")}</p>
          <div className="ox-actions"><a className="ox-primary" href="#source"><Code2 size={18}/> {tx("查看源码结构", "Explore the source")} <ArrowRight size={16}/></a><button className="ox-secondary" onClick={() => openDemo("model")}><Play size={17}/> {tx("在线体验", "Try online")}</button></div>
          <div className="ox-meta"><span><Check size={13}/> Apache-2.0</span><span><Check size={13}/> {tx("TypeScript 全栈", "TypeScript full stack")}</span><span><Check size={13}/> {tx("核心无私有依赖", "No private core dependencies")}</span></div>
        </div>
        <div className="ox-console">
          <figure className="ox-mascot"><img src={XYAI_MASCOT_SRC} alt={tx("腹部带有 XYAI 标志的卡通智能助手", "XYAI assistant mascot with a chest logo")} width="820" height="931" fetchPriority="high"/></figure>
          <header><div><i/><i/><i/></div><span><Terminal size={13}/> openxyos / quick-start</span><Braces size={15}/></header>
          <div className="ox-terminal"><p><b>$</b> npm ci</p><p><b>$</b> npm run dev</p><hr/><p className="dim">✓ tenant isolation ready</p><p className="dim">✓ organization graph mounted</p><p className="dim">✓ agent governance online</p><p className="ready"><Sparkles size={14}/> openXYOS is running</p><button onClick={() => void copyInstall()}><Copy size={13}/> {copied ? tx("已复制", "Copied") : tx("复制命令", "Copy command")}</button></div>
          <footer><span>{tx("组织", "Organization")}</span><i/><span>{tx("智能体", "Agents")}</span><i/><span>{tx("协作", "Collaboration")}</span><i/><span>{tx("审计", "Audit")}</span></footer>
        </div>
        <HeroWaterScene/>
        <a className="ox-scroll" href="#capabilities"><ChevronDown size={20}/></a>
      </section>
      <section id="capabilities" className="ox-section"><div className="ox-heading"><small>CORE / 01</small><h2>{tx("精简产品表面，保留组织智能底座", "A focused product surface, with the organizational intelligence core intact")}</h2><p>{tx("不复制庞杂行业应用，只保留构建人机组织所需的核心机制与可运行示例。", "Keep the core mechanisms and working examples required to build human–AI organizations.")}</p></div><div className="ox-cards">{CAPABILITIES.map(({icon: Icon,title,text},i) => <article key={title[0]}><em>0{i+1}</em><Icon size={23}/><h3>{isEnglish ? title[1] : title[0]}</h3><p>{isEnglish ? text[1] : text[0]}</p></article>)}</div></section>
      <AgentJourneyDemo onExperience={() => openDemo("model")}/>
      <section id="architecture" className="ox-architecture"><div className="ox-heading"><small>ARCHITECTURE / 03</small><h2>{tx("一个开放内核，连接人与智能体", "One open core, connecting people and agents")}</h2></div><div className="ox-layers"><div><small>EXPERIENCE</small><b>{tx("Web 工作台", "Web workspace")}</b><b>{tx("管理控制台", "Admin console")}</b><b>{tx("开发者 API", "Developer API")}</b></div><span>•••</span><div className="core"><small>OPENXYOS CORE</small><b>{tx("租户与组织", "Tenants & organization")}</b><b>{tx("智能体运行时", "Agent runtime")}</b><b>{tx("协作与治理", "Collaboration & governance")}</b><b>{tx("模块注册", "Module registry")}</b></div><span>•••</span><div><small>INFRASTRUCTURE</small><b>SQLite / PostgreSQL</b><b>WebSocket</b><b>{tx("模型与工具", "Models & tools")}</b></div></div></section>
      <section id="modules" className="ox-section"><div className="ox-heading"><small>MODULES / 04</small><h2>{tx("12 个清晰模块，按租户组合", "Twelve clear modules, composed per tenant")}</h2><p>{tx("后台可启停业务模块并编辑显示名称；基础入口常驻，示例模块保留完整前后端链路供二次开发。", "Administrators can enable, disable, and rename modules. Foundation entry points remain available, while sample modules keep end-to-end paths for extension.")}</p></div><div className="ox-module-table"><header><span>package</span><span>{tx("显示名称", "Display name")}</span><span>edition</span><span>status</span></header>{MODULES.map(([key,label,type]) => <div className="row" key={key}><code>@openxyos/{key}</code><span>{isEnglish ? ({ workspace: "Workspace", announcements: "Announcements", organization: "Organization", people: "Human–AI resources", skills: "Skills & plugins", chat: "Collaboration", agents: "Agent Studio", tasks: "Tasks", knowledge: "Knowledge", reflections: "Reflection engine", governance: "Governance engine", settings: "System settings" } as Record<string, string>)[key] : label}</span><em className={type}>{type === "base" ? tx("基础", "base") : type === "core" ? tx("核心", "core") : tx("示例", "sample")}</em><small><i/> ready</small></div>)}</div></section>
      <section id="source" className="ox-section ox-source"><div><small>SOURCE / 05</small><h2>{tx("从源码开始理解 openXYOS", "Understand openXYOS from the source")}</h2><p>{tx("前后端、数据迁移、权限策略、模块契约与验证脚本全部纳入社区源码边界。构建通过不等于生产就绪，项目会明确标注已验证与待验证状态。", "Frontend, backend, migrations, access policies, module contracts, and verification scripts are all inside the community source boundary. A successful build is not a production claim: verified and unverified states are explicit.")}</p><div className="ox-actions">{GITHUB_URL ? <a className="ox-primary" href={GITHUB_URL} target="_blank" rel="noreferrer"><Github size={18}/> {tx("打开 GitHub", "Open GitHub")}</a> : <a className="ox-primary" href="#contribute"><GitBranch size={18}/> {tx("参与首发准备", "Join the launch")}</a>}</div></div><div className="ox-tree"><p>openxyos/</p><p>├─ <b>frontend/</b><em>{tx("工作台与管理界面", "Workspace and admin UI")}</em></p><p>├─ <b>backend/</b><em>{tx("API、治理与智能体服务", "API, governance, and agent services")}</em></p><p>├─ <b>scripts/</b><em>{tx("测试与开源检查", "Tests and open-source checks")}</em></p><p>├─ <b>deploy/</b><em>{tx("社区部署参考", "Community deployment reference")}</em></p><p>└─ <b>docs/</b><em>{tx("架构、契约与贡献说明", "Architecture, contracts, and contribution guide")}</em></p></div></section>
      <section id="contribute" className="ox-contribute"><div><Users size={31}/></div><small>BUILD WITH US</small><h2>{tx("不只使用系统，一起定义人机组织的未来", "Do more than use the system—define the future of human–AI organizations")}</h2><p>{tx("欢迎从组织模型、智能体协作、治理策略、模块生态和工程质量开始贡献。", "Contribute through organization models, agent collaboration, governance policy, module ecosystems, and engineering quality.")}</p><div className="ox-actions">{GITHUB_URL ? <a className="ox-primary" href={GITHUB_URL + "/issues"} target="_blank" rel="noreferrer"><Github size={18}/> {tx("查看 Issues", "View issues")}</a> : <a className="ox-primary" href="#source"><Code2 size={18}/> {tx("阅读源码边界", "Read source boundary")}</a>}<button className="ox-secondary" onClick={() => openDemo("model")}>{tx("进入系统", "Enter system")} <ArrowRight size={16}/></button></div></section>
    </main>
    <footer className="ox-footer"><span className="ox-brand"><i><Network size={16}/></i><b>open<span>XYOS</span></b></span><p>Open-source operating system for human–agent organizations.</p><small>Apache License 2.0 · Built in the open</small></footer>
    {demoOpen && <div className="ox-overlay" onMouseDown={() => setDemoOpen(false)}><div className={`ox-dialog ${demoPhase === "model" ? "model-dialog" : ""}`} role="dialog" aria-modal="true" aria-labelledby="demo-title" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setDemoOpen(false)} aria-label={tx("关闭", "Close")}><X size={18}/></button>{demoPhase === "model" ? <><i className="icon"><KeyRound size={22}/></i><h2 id="demo-title">{tx("接入大模型，体验完整智能能力", "Connect a model to experience full intelligence")}</h2><p>{tx("选择你已有 API Key 的模型服务。密钥保存到当前本地演示租户，页面不会回显原文；之后可在“系统设置 → AI 大模型”中更换。", "Choose a model service for which you have an API key. The key is stored only in the current demo tenant and is never shown back in plain text; change it later in System Settings → AI Models.")}</p><div className="model-presets">{EXPERIENCE_MODELS.map(model => <button key={model.id} className={providerId === model.id ? "selected" : ""} onClick={() => setProviderId(model.id)}><b>{model.name}</b><span>{model.provider}</span><small>{isEnglish ? model.hintEn : model.hint}</small></button>)}</div><label className="api-key-field"><span>API Key</span><div><KeyRound size={15}/><input type={showKey ? "text" : "password"} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={tx("输入所选模型服务商的 API Key", "Enter the selected provider API key")} autoComplete="off" spellCheck={false}/><button onClick={() => setShowKey(value => !value)} aria-label={showKey ? tx("隐藏 API Key", "Hide API key") : tx("显示 API Key", "Show API key")}>{showKey ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><div className="key-notice"><ShieldCheck size={15}/><span>{tx("Key 仅发送到当前 openXYOS 后端，不写入浏览器日志，也不会再次明文返回。", "The key is sent only to the current openXYOS backend, never logged in the browser, and never returned in plain text.")}</span></div>{loginState !== "idle" && <p className="feedback">{tx("正在登录演示租户并保存模型配置…", "Signing in to the demo tenant and saving model configuration…")}</p>}{loginError && <p className="error">{loginError}</p>}<div className="model-actions"><button className="ox-primary" onClick={() => void saveModelAndEnter()} disabled={loginState !== "idle"}>{tx("保存并进入智能体验", "Save and enter intelligent experience")} <ArrowRight size={16}/></button><button className="ox-secondary" onClick={() => { setDemoPhase("account"); setLoginError(""); }}>{tx("暂不配置，只体验基础功能", "Skip for now and explore core functions")}</button></div></> : <><i className="icon"><LockKeyhole size={22}/></i><h2 id="demo-title">{tx("选择测试视角", "Choose a demo perspective")}</h2><p>{tx("使用本地演示租户进入真实系统。管理员可体验模块开关和名称编辑，普通员工只看到已授权能力。", "Enter the live system with the local demo tenant. Administrators can manage modules and labels; users see only authorized capabilities.")}</p><button className="account" onClick={() => void enterDemo("admin")} disabled={loginState !== "idle"}><span><b>{tx("管理员", "Administrator")}</b><small>demo@demo.com · {tx("密码", "password")} openxyos-demo-2026</small></span><ArrowRight size={17}/></button><button className="account" onClick={() => void enterDemo("user")} disabled={loginState !== "idle"}><span><b>{tx("普通员工", "Employee")}</b><small>user@demo.com · {tx("密码", "password")} openxyos-demo-2026</small></span><ArrowRight size={17}/></button>{loginState !== "idle" && <p className="feedback">{tx("正在连接演示环境…", "Connecting to the demo environment…")}</p>}{loginError && <p className="error">{loginError}</p>}<button className="manual" onClick={() => navigate("/auth")}>{tx("使用其他账号登录", "Sign in with another account")}</button></>}</div></div>}
  </div>;
}
