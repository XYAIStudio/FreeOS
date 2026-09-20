import { useEffect, useMemo, useState } from "react";
import { LINKS, copy, type Locale } from "./copy";

const POSES = ["welcome", "empty", "peek", "think", "type", "tasks"] as const;
type Pose = (typeof POSES)[number];

const STORAGE_KEY = "freeos-locale";

function mascotSrc(pose: Pose): string {
  return `./mascot/${pose}.webp`;
}

function readLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;
  return "zh";
}

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.05 10.05 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 13.6V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function DualLoop({ locale }: { locale: Locale }) {
  const t = copy[locale].engines;
  return (
    <div className="cycle" aria-hidden="true">
      <div className="cycle-cell out">
        <em>01</em>
        <span>{t.flowOut}</span>
      </div>
      <div className="cycle-arrow east" />
      <div className="cycle-cell assemble">
        <em>02</em>
        <span>{t.flowAssemble}</span>
      </div>
      <div className="cycle-arrow south" />
      <div className="cycle-arrow north" />
      <div className="cycle-cell spawn">
        <em>04</em>
        <span>{t.flowSpawn}</span>
      </div>
      <div className="cycle-arrow west" />
      <div className="cycle-cell back">
        <em>03</em>
        <span>{t.flowBack}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [navOpen, setNavOpen] = useState(false);
  const [heroPose, setHeroPose] = useState<Pose>("welcome");
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const t = copy[locale];
  const poseAlts = useMemo(
    () => ({
      welcome: t.hero.mascotAlt,
      empty: locale === "zh" ? "XYAI 机器人展示空白工作区" : "XYAI robot holding an empty workspace",
      peek: locale === "zh" ? "XYAI 机器人探头问候" : "XYAI robot peeking over the edge",
      think: locale === "zh" ? "XYAI 机器人思考" : "XYAI robot thinking",
      type: locale === "zh" ? "XYAI 机器人在笔记本上工作" : "XYAI robot typing on a laptop",
      tasks: locale === "zh" ? "XYAI 机器人出示数字同事卡片" : "XYAI robot holding a colleague card",
    }),
    [locale, t.hero.mascotAlt],
  );

  const cycleHero = () => {
    setHeroPose((current) => POSES[(POSES.indexOf(current) + 1) % POSES.length]);
  };

  const closeNav = () => setNavOpen(false);

  return (
    <div className="page">
      <a className="skip" href="#top">
        {t.skip}
      </a>
      <div className="orbits" aria-hidden="true">
        <i className="arc yellow" />
        <i className="arc green" />
        <i className="arc red" />
        <i className="wash" />
      </div>

      <header className="nav">
        <a className="brand" href="#top" onClick={closeNav}>
          <img src="./logo.png" alt="" width={32} height={32} />
          <span>FreeOS</span>
        </a>
        <nav className={`links${navOpen ? " open" : ""}`} aria-label={locale === "zh" ? "主导航" : "Primary"}>
          <a href="#engines" onClick={closeNav}>
            {t.nav.engines}
          </a>
          <a href="#journey" onClick={closeNav}>
            {t.nav.journey}
          </a>
          <a href="#capabilities" onClick={closeNav}>
            {t.nav.capabilities}
          </a>
          <a href="#download" onClick={closeNav}>
            {t.nav.download}
          </a>
          <a href="#loop" onClick={closeNav}>
            {t.nav.loop}
          </a>
          <a href="#faq" onClick={closeNav}>
            {t.nav.faq}
          </a>
        </nav>
        <div className="nav-actions">
          <div className="lang" role="group" aria-label="Language">
            <button type="button" className={locale === "zh" ? "on" : ""} onClick={() => setLocale("zh")}>
              中
            </button>
            <button type="button" className={locale === "en" ? "on" : ""} onClick={() => setLocale("en")}>
              EN
            </button>
          </div>
          <a className="nav-git" href={LINKS.github} target="_blank" rel="noreferrer">
            <IconGitHub />
            GitHub
          </a>
          <button
            className={`menu${navOpen ? " open" : ""}`}
            type="button"
            aria-expanded={navOpen}
            aria-label={navOpen ? "Close" : "Menu"}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <img src="./logo.png" alt="" width={18} height={18} />
              {t.hero.eyebrow}
            </p>
            <h1>
              <span className="headline-l1">{t.hero.headline[0]}</span>
              <span className="headline-l2">{t.hero.headline[1]}</span>
            </h1>
            <p className="promise">
              {t.hero.promise}
              <span className="times">{t.hero.times}</span>
              <span className="org-line">{t.hero.org}</span>
            </p>
            <p className="lead">{t.hero.lead}</p>
            <div className="hero-actions">
              <a className="btn primary" href={LINKS.releases} target="_blank" rel="noreferrer">
                <IconDownload />
                {t.hero.download}
              </a>
              <a className="btn ghost" href={LINKS.github} target="_blank" rel="noreferrer">
                <IconGitHub />
                {t.hero.github}
              </a>
            </div>
            <ul className="chips">
              {t.hero.chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          </div>
          <figure className="hero-mascot">
            <button type="button" onClick={cycleHero} title={t.hero.mascotHint} aria-label={t.hero.mascotHint}>
              <img src={mascotSrc(heroPose)} alt={poseAlts[heroPose]} width={820} height={820} />
            </button>
            <figcaption>{t.hero.mascotHint}</figcaption>
          </figure>
        </section>

        <section className="manifesto" aria-label={t.manifesto}>
          <p className="manifesto-text">{t.manifesto}</p>
        </section>

        <section className="section stack-section" aria-label={t.stackHead.title}>
          <div className="heading">
            <small>{t.stackHead.kicker}</small>
            <h2>{t.stackHead.title}</h2>
            <p>{t.stackHead.lead}</p>
          </div>
          <div className="stack">
            {t.stack.map((item) => (
              <article key={item.no}>
                <small>
                  {item.no} / {item.layer}
                </small>
                <h3>{item.name}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="engines" className="section engines">
          <div className="heading">
            <small>{t.engines.kicker}</small>
            <h2>{t.engines.title}</h2>
            <p>{t.engines.lead}</p>
          </div>
          <div className="engine-pair">
            <article className="engine data">
              <img src={mascotSrc("think")} alt={poseAlts.think} width={280} height={280} />
              <small>{t.engines.dataLicense}</small>
              <h3>{t.engines.dataTitle}</h3>
              <p>{t.engines.dataBody}</p>
            </article>
            <article className="engine control">
              <img src={mascotSrc("peek")} alt={poseAlts.peek} width={280} height={280} />
              <small>{t.engines.controlLicense}</small>
              <h3>{t.engines.controlTitle}</h3>
              <p>{t.engines.controlBody}</p>
            </article>
          </div>
          <DualLoop locale={locale} />
          <p className="engine-note">{t.engines.note}</p>
        </section>

        <section id="journey" className="section journey">
          <div className="heading">
            <small>{t.journey.kicker}</small>
            <h2>{t.journey.title}</h2>
            <p>{t.journey.lead}</p>
          </div>
          <div className="journey-showcase">
            <figure className="journey-media">
              <img
                src="./openxyos-agent-workflow.gif"
                alt={t.journey.caption}
                width={900}
                height={563}
                loading="lazy"
              />
              <figcaption>{t.journey.caption}</figcaption>
            </figure>
            <aside className="journey-summary">
              <ol className="journey-steps">
                {t.journey.steps.map((step, i) => (
                  <li key={step}>
                    <em>{String(i + 1).padStart(2, "0")}</em>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p>{t.journey.note}</p>
            </aside>
          </div>
        </section>

        <section id="capabilities" className="section capabilities">
          <div className="heading split">
            <div>
              <small>{t.capabilities.kicker}</small>
              <h2>{t.capabilities.title}</h2>
              <p>{t.capabilities.lead}</p>
            </div>
            <img className="cap-mascot" src={mascotSrc("empty")} alt={poseAlts.empty} width={220} height={220} />
          </div>
          <div className="cap-groups">
            {t.capabilities.groups.map((group) => (
              <div key={group.title} className="cap-group">
                <h3>{group.title}</h3>
                <div className="cap-cards">
                  {group.items.map((item) => (
                    <article key={item.name}>
                      <span className="cap-tag">{item.tag}</span>
                      <h4>{item.name}</h4>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="download" className="section download">
          <div className="heading">
            <small>{t.download.kicker}</small>
            <h2>{t.download.title}</h2>
            <p>{t.download.lead}</p>
          </div>
          <div className="hero-actions">
            <a className="btn primary" href={LINKS.releases} target="_blank" rel="noreferrer">
              <IconDownload />
              {t.download.cta}
            </a>
          </div>
          <p className="center-link">{t.download.hint}</p>
          <div className="steps-cli">
            <ol className="steps">
              <li className="steps-title">{t.download.stepsTitle}</li>
              {t.download.steps.map((step, i) => (
                <li key={step}>
                  <em>{String(i + 1).padStart(2, "0")}</em>
                  {step}
                </li>
              ))}
            </ol>
            <div className="cli">
              <p>{t.download.cliTitle}</p>
              <small>{t.download.cliHint}</small>
              <pre>
                <code>
                  {`git clone ${LINKS.github}.git
cd FreeOS
uv sync
uv run freeos org loop run`}
                </code>
              </pre>
              <p className="data-note">{t.download.dataNote}</p>
            </div>
          </div>
        </section>

        <section id="loop" className="section loop">
          <div className="heading">
            <small>{t.loop.kicker}</small>
            <h2>{t.loop.title}</h2>
            <p>{t.loop.lead}</p>
          </div>
          <ol className="loop-steps">
            {t.loop.steps.map((step, i) => (
              <li key={step.title}>
                <em>{String(i + 1).padStart(2, "0")}</em>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="life">
            <h3>{t.loop.lifeTitle}</h3>
            <ol>
              {t.loop.life.map((stage) => (
                <li key={stage}>{stage}</li>
              ))}
            </ol>
            <p>{t.loop.lifeNote}</p>
          </div>
        </section>

        <section id="faq" className="section faq">
          <div className="heading split">
            <div>
              <small>{t.faq.kicker}</small>
              <h2>{t.faq.title}</h2>
            </div>
            <img className="cap-mascot peek" src={mascotSrc("peek")} alt={poseAlts.peek} width={200} height={200} />
          </div>
          <div className="faq-list">
            {t.faq.items.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className={`faq-item${open ? " open" : ""}`}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? -1 : i)}>
                    {item.q}
                    <span aria-hidden="true">{open ? "–" : "+"}</span>
                  </button>
                  {open ? <p>{item.a}</p> : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="section proof" aria-label={t.proof.kicker}>
          <div className="heading">
            <small>{t.proof.kicker}</small>
            <h2>{t.proof.title}</h2>
          </div>
          <div className="proof-grid">
            {t.proof.items.map((item, i) => (
              <article key={item.title} className="proof-card">
                <em>{String(i + 1).padStart(2, "0")}</em>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <img src={mascotSrc("welcome")} alt={poseAlts.welcome} width={180} height={180} />
          <h2>{t.cta.title}</h2>
          <p>{t.cta.lead}</p>
          <div className="hero-actions">
            <a className="btn primary" href={LINKS.releases} target="_blank" rel="noreferrer">
              <IconDownload />
              {t.cta.download}
            </a>
            <a className="btn ghost" href={LINKS.github} target="_blank" rel="noreferrer">
              <IconGitHub />
              {t.cta.github}
            </a>
            <a className="btn ghost" href={LINKS.openxyosSite} target="_blank" rel="noreferrer">
              {t.cta.openxyos}
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <div>
            <a className="brand" href="#top">
              <img src="./logo.png" alt="" width={28} height={28} />
              <span>FreeOS</span>
            </a>
            <p>{t.footer.blurb}</p>
          </div>
          <div>
            <b>{t.footer.product}</b>
            <a href={LINKS.site}>{t.footer.home}</a>
            <a href={LINKS.releases} target="_blank" rel="noreferrer">
              {t.footer.links.releases}
            </a>
            <a href={LINKS.productContract} target="_blank" rel="noreferrer">
              {t.footer.links.contract}
            </a>
            <a href={LINKS.architecture} target="_blank" rel="noreferrer">
              {t.footer.links.docs}
            </a>
            <a href={LINKS.assetLoop} target="_blank" rel="noreferrer">
              {t.footer.links.loop}
            </a>
          </div>
          <div>
            <b>{t.footer.legal}</b>
            <a href={LINKS.notice} target="_blank" rel="noreferrer">
              {t.footer.links.notice}
            </a>
            <a href={LINKS.octopUpstream} target="_blank" rel="noreferrer">
              {t.footer.links.octop}
            </a>
            <a href={LINKS.openxyos} target="_blank" rel="noreferrer">
              {t.footer.links.openxyos}
            </a>
          </div>
        </div>
        <p className="attrib">{t.footer.attrib}</p>
        <small>{t.footer.copyright}</small>
      </footer>
    </div>
  );
}
