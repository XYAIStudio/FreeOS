import { useEffect, useRef } from "react";
import { XYOS_WATER_LOGO_SRC } from "../brandAssets";
import "./hero-water.css";

/** Brand animation only: falling water, impact waves, then a raised enamel logo. */
export default function HeroWaterScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const logo = new Image();
    logo.src = XYOS_WATER_LOGO_SRC;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, width = 0, height = 0, fontReady = false, disposed = false;
    const start = performance.now();
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ellipse = (x: number, y: number, rx: number, ry: number) => {
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2);
    };
    const draw = () => {
      const t = motion.matches ? 5 : ((performance.now() - start) / 1000) % 10;
      const x = width / 2, water = height * .7;
      const spread = Math.min(width * .46, 480);
      ctx.clearRect(0, 0, width, height);
      // A real water plane gives the falling drop, splash and reflection one
      // shared physical surface instead of floating on an empty white canvas.
      const surface = ctx.createLinearGradient(0, height * .42, 0, height);
      surface.addColorStop(0, "rgba(220,237,255,0)");
      surface.addColorStop(.4, "rgba(168,206,244,.22)");
      surface.addColorStop(1, "rgba(102,163,224,.26)");
      ctx.fillStyle = surface; ctx.fillRect(0, height * .42, width, height * .58);
      ctx.save(); ctx.translate(x, water); ctx.scale(1, .25);
      const light = ctx.createRadialGradient(0, 0, 5, 0, 0, spread);
      light.addColorStop(0, "#174c6a99"); light.addColorStop(.42, "#123f694d"); light.addColorStop(1, "#05101900");
      ctx.fillStyle = light; ctx.fillRect(-spread, -spread, spread * 2, spread * 2); ctx.restore();
      // Fine surface contours catch light even before impact.
      for (let i = 0; i < 18; i++) {
        const r = 26 + i * spread / 18;
        ellipse(x, water, r, r * .22);
        ctx.strokeStyle = `rgba(100,188,221,${.025 + .018 * Math.sin(i * 1.4 + t)})`;
        ctx.lineWidth = .6; ctx.stroke();
      }
      if (t < 1.5) {
        const fall = t / 1.5;
        const y = 15 + (water - 22) * fall * fall;
        ctx.save(); ctx.translate(x, y);
        const drop = ctx.createLinearGradient(-9, 0, 9, 20);
        drop.addColorStop(0, "#e0fbff"); drop.addColorStop(.3, "#5cd9ff"); drop.addColorStop(1, "#1262b5");
        ctx.fillStyle = drop; ctx.shadowColor = "#40bfff"; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.bezierCurveTo(-2, -4, -11, 2, -9, 10);
        ctx.bezierCurveTo(-7, 22, 8, 22, 10, 10); ctx.bezierCurveTo(11, 2, 2, -5, 0, -16); ctx.fill();
        ctx.restore();
      }
      const impact = t - 1.5;
      if (impact >= 0) {
        // A short, asymmetric crown makes the instant of impact legible.
        if (impact < .72) {
          const crown = Math.sin(impact / .72 * Math.PI) * 30;
          ctx.save(); ctx.strokeStyle = `rgba(188,231,255,${.5 - impact * .35})`;
          ctx.shadowColor = "rgba(83,163,239,.55)"; ctx.shadowBlur = 10; ctx.lineWidth = 1.7;
          ctx.beginPath(); ctx.moveTo(x - crown * 1.7, water + 2);
          ctx.bezierCurveTo(x - crown, water - crown * .55, x - crown * .28, water - crown * .72, x, water - crown * .1);
          ctx.bezierCurveTo(x + crown * .32, water - crown * .8, x + crown * 1.04, water - crown * .5, x + crown * 1.65, water + 2);
          ctx.stroke(); ctx.restore();
        }
        for (let i = 0; i < 7; i++) {
          const age = impact - i * .26;
          if (age < 0) continue;
          const progress = age / 6.8;
          if (progress > 1) continue;
          const r = 9 + spread * (1 - Math.exp(-progress * 2));
          ellipse(x, water, r, r * .23);
          ctx.strokeStyle = `rgba(105,217,255,${Math.pow(1 - progress, 2) * .64})`;
          ctx.shadowColor = "#278fe9"; ctx.shadowBlur = 8; ctx.lineWidth = 1.15; ctx.stroke();
          ctx.shadowBlur = 0;
          ellipse(x, water + 2, r + 4, r * .23);
          ctx.strokeStyle = `rgba(29,99,160,${(1 - progress) * .3})`; ctx.lineWidth = 2; ctx.stroke();
        }
        if (impact < 1.1) {
          for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            const px = x + Math.cos(a) * impact * 56;
            const py = water + Math.sin(a) * impact * 15 - Math.sin(impact / 1.1 * Math.PI) * (24 + (i % 3) * 9);
            ellipse(px, py, 1.3, 2.2); ctx.fillStyle = `rgba(168,235,255,${1-impact/1.1})`; ctx.fill();
          }
        }
      }
      // Extruded metallic edge and reflected face give the supplied mark volume.
      const rise = Math.max(0, Math.min(1, (t - 2.1) / 1.8));
      const fade = t > 8.6 ? Math.max(0, (10 - t) / 1.4) : 1;
      const eased = 1 - Math.pow(1 - rise, 3);
      if (rise > 0 && logo.complete && logo.naturalWidth) {
        const r = Math.min(58, width * .13), y = water - eased * (r + 12);
        // Finish upright: equal X/Y scale presents the circular mark face-on.
        const turn = Math.max(0, Math.min(1, (t - 2.5) / 2));
        const tilt = .23 + (1 - Math.pow(1 - turn, 3)) * .77;
        ctx.save(); ctx.globalAlpha = fade * eased;
        // Keep the reflection soft on the light landing canvas; a black oval
        // makes the water mark look detached from the rest of the page.
        ellipse(x, water + 8, r * 1.3, 12); ctx.fillStyle = "rgba(82,112,156,.26)"; ctx.fill();
        ctx.save(); ctx.translate(x, water + 27); ctx.scale(1, -.22);
        ctx.globalAlpha *= .12; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(logo, 8, 4, 149, 148, -r, -r, r*2, r*2); ctx.restore();
        for (let depth = 10; depth >= 0; depth--) {
          ellipse(x, y + depth * (1 - turn * .8), r + 2, r * tilt);
          ctx.fillStyle = depth > 5 ? "#123c52" : "#63a0b3"; ctx.fill();
        }
        ctx.save(); ctx.translate(x, y); ctx.scale(1, tilt);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(logo, 8, 4, 149, 148, -r, -r, r*2, r*2);
        const sheen = ctx.createLinearGradient(-r, -r, r, r);
        sheen.addColorStop(0, "#ffffff77"); sheen.addColorStop(.45, "#ffffff00"); sheen.addColorStop(1, "#06345633");
        ctx.fillStyle = sheen; ctx.fillRect(-r,-r,r*2,r*2); ctx.restore();
        ellipse(x, y, r+1, r*tilt); ctx.strokeStyle = "#c5f5ffb3"; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
        if (fontReady) {
          // The wordmark shares the logo's rise clock and settles 14px above its face.
          const size = r * .5;
          const textY = water - eased * (r * 2 + 26);
          ctx.save(); ctx.globalAlpha = fade * eased;
          ctx.font = `700 ${size}px "OpenXYOS Source Han"`;
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          const measured = ctx.measureText("openXYOS").width;
          const textScale = r * 2 * 1.45 / Math.max(1, measured);
          // Dim reflection remains attached to the water while the lettering rises.
          ctx.save(); ctx.translate(x, water + 44); ctx.scale(textScale, -.23);
          ctx.globalAlpha *= .1; ctx.fillStyle = "#8dddff";
          ctx.fillText("openXYOS", 0, 0); ctx.restore();
          ctx.translate(x, textY); ctx.scale(textScale, .25 + .75 * eased);
          for (let depth = 5; depth > 0; depth--) {
          ctx.fillStyle = depth > 2 ? "#3a63a8" : "#79a7e2";
            ctx.fillText("openXYOS", depth * .35, depth * .75);
          }
          const face = ctx.createLinearGradient(0, -size, 0, 3);
          face.addColorStop(0, "#f5f9ff"); face.addColorStop(.42, "#bfd4ff");
          face.addColorStop(.65, "#5f8fe4"); face.addColorStop(1, "#d5e4ff");
          ctx.fillStyle = face; ctx.shadowColor = "#54c6ed66"; ctx.shadowBlur = 7;
          ctx.fillText("openXYOS", 0, 0); ctx.restore();
        }
      }
      if (!motion.matches && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); draw(); };
    void document.fonts.load('700 30px "OpenXYOS Source Han"', "openXYOS").then(fonts => {
      if (!disposed) { fontReady = fonts.length > 0; restart(); }
    }).catch(() => { /* Preserve the logo animation if the font cannot load. */ });
    const observer = new ResizeObserver(() => { resize(); restart(); });
    observer.observe(canvas); logo.onload = restart;
    motion.addEventListener("change", restart); document.addEventListener("visibilitychange", restart);
    resize(); draw();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); logo.onload = null; motion.removeEventListener("change", restart); document.removeEventListener("visibilitychange", restart); };
  }, []);
  return <div className="ox-water-scene" role="img" aria-label="水滴落入水面，立体 Logo 与思源黑体 openXYOS 字标同步浮出，字标悬停在 Logo 正上方"><canvas ref={ref}/></div>;
}
