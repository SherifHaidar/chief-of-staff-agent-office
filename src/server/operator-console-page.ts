export function renderOperatorConsolePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Office Operator Console</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #eef1f4;
      --panel: #ffffff;
      --panel-soft: #f7f9fb;
      --panel-strong: #111827;
      --text: #1f2937;
      --muted: #64748b;
      --border: #d8dee8;
      --border-strong: #bac3d0;
      --accent: #2454d6;
      --accent-soft: #e8eefc;
      --accent-strong: #183fa5;
      --emerald: #0f8a5f;
      --emerald-soft: #e6f4ee;
      --indigo: #4f46e5;
      --ink: #0f172a;
      --danger: #b42318;
      --ok: #117044;
      --warn: #a15c07;
      --shadow: 0 20px 60px rgba(15, 23, 42, 0.09);
      --shadow-soft: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f4f6f8; color: var(--text); }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(238,241,244,0.92)); }
    main { position: relative; width: min(1480px, calc(100vw - 28px)); margin: 18px auto 32px; }
    h1 { margin: 0; font-size: 24px; line-height: 1.12; font-weight: 760; color: var(--ink); }
    h2 { margin: 0; font-size: 17px; line-height: 1.2; color: var(--ink); }
    h3 { margin: 18px 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0; color: var(--muted); }
    p { margin: 0; color: var(--muted); line-height: 1.5; }
    .app-shell { min-height: calc(100vh - 36px); display: grid; grid-template-columns: 270px minmax(0, 1fr) 340px; gap: 14px; align-items: stretch; }
    .office-nav, .command-center, .case-file { background: rgba(255,255,255,0.94); border: 1px solid rgba(216,222,232,0.95); border-radius: 8px; box-shadow: var(--shadow); }
    .office-nav { display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; }
    .office-identity { padding: 18px; border-bottom: 1px solid var(--border); background: #fbfcfe; }
    .eyebrow { margin-bottom: 5px; color: var(--accent-strong); font-size: 11px; font-weight: 760; text-transform: uppercase; letter-spacing: 0; }
    .office-identity p { margin-top: 7px; font-size: 13px; }
    .nav-section { padding: 14px; display: grid; gap: 8px; align-content: start; }
    .nav-label { font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 760; }
    .desk-nav { display: grid; gap: 8px; }
    .desk-item { width: 100%; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: center; text-align: left; padding: 10px; background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: none; }
    .desk-item:hover { border-color: var(--border-strong); color: var(--ink); background: #f9fbfd; }
    .desk-item.active { border-color: rgba(36,84,214,0.55); background: var(--accent-soft); }
    .desk-index { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 7px; background: #edf2f7; color: #475569; font-size: 12px; font-weight: 760; }
    .desk-item.active .desk-index { background: var(--accent); color: #fff; }
    .desk-name { display: block; color: var(--ink); font-size: 13px; font-weight: 720; }
    .desk-duty { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; line-height: 1.3; }
    .nav-footer { padding: 14px; border-top: 1px solid var(--border); background: #fbfcfe; display: grid; gap: 10px; }
    .command-center { display: grid; grid-template-rows: auto auto minmax(0, 1fr); overflow: hidden; }
    .command-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--border); background: #fbfcfe; }
    .command-title { display: grid; gap: 7px; }
    .command-title p { font-size: 13px; }
    .command-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .command-actions { display: grid; gap: 8px; align-content: start; justify-items: end; min-width: 250px; }
    .signal-row { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
    .showcase-toggle { display: inline-flex; align-items: center; gap: 8px; margin: 0; border: 1px solid var(--border-strong); border-radius: 999px; padding: 7px 10px; background: #fff; box-shadow: var(--shadow-soft); color: var(--text); cursor: pointer; }
    .showcase-toggle input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); }
    .showcase-toggle span { font-size: 12px; font-weight: 760; }
    .lifecycle { display: grid; grid-template-columns: repeat(8, minmax(92px, 1fr)); gap: 1px; background: var(--border); border-bottom: 1px solid var(--border); overflow-x: auto; }
    .life-step { min-height: 74px; padding: 10px; background: #fff; display: grid; align-content: center; gap: 5px; border: 0; border-radius: 0; box-shadow: none; color: var(--muted); cursor: default; }
    .life-step span:first-child { font-size: 11px; font-weight: 760; color: inherit; }
    .life-step span:last-child { font-size: 12px; color: var(--ink); font-weight: 650; }
    .life-step.done { background: #f8fafc; color: var(--emerald); }
    .life-step.active { background: #eef4ff; box-shadow: inset 0 -3px 0 var(--accent); color: var(--accent-strong); }
    .workspace-body { padding: 16px 18px 18px; display: grid; gap: 14px; align-content: start; overflow: auto; }
    .work-panel, .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: none; padding: 14px; }
    .panel { background: var(--panel-soft); }
    .section-heading { display: grid; gap: 4px; margin-bottom: 4px; }
    .section-heading h2 { margin: 0; color: var(--ink); }
    .field { display: grid; gap: 8px; }
    .credential-panel { display: grid; gap: 8px; }
    label { display: block; font-size: 13px; font-weight: 650; margin-bottom: 8px; }
    input, select, textarea { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 11px 12px; font: inherit; color: var(--text); background: #fff; }
    textarea { min-height: 94px; resize: vertical; line-height: 1.45; }
    input:focus, select:focus, textarea:focus { outline: 2px solid rgba(36, 84, 214, 0.16); border-color: var(--accent); }
    button { border: 1px solid var(--border); background: #fff; color: var(--text); border-radius: 6px; min-height: 38px; padding: 8px 12px; font: inherit; font-weight: 680; cursor: pointer; box-shadow: 0 1px 0 rgba(16, 24, 40, 0.04); transition: border-color 140ms ease, color 140ms ease, background 140ms ease, transform 140ms ease; }
    button:hover { border-color: var(--accent); color: var(--accent-strong); }
    button:active { transform: translateY(1px); }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    button.primary:hover { background: var(--accent-strong); color: #fff; }
    button.danger { border-color: rgba(180, 35, 24, 0.35); color: var(--danger); }
    button:disabled { opacity: 0.48; cursor: not-allowed; }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .stack { display: grid; gap: 12px; }
    .command-strip { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; }
    .tasks { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-top: 4px; }
    .task { width: 100%; text-align: left; display: grid; gap: 6px; padding: 12px; background: var(--panel-soft); }
    .task strong { font-size: 14px; color: var(--ink); }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
    .pill { border: 1px solid var(--border); border-radius: 999px; padding: 3px 8px; background: #fbfcfd; color: #475467; font-size: 12px; white-space: nowrap; }
    .pill.ok { border-color: rgba(15,138,95,0.25); background: var(--emerald-soft); color: #0b6b4a; }
    .pill.warn { border-color: rgba(161,92,7,0.28); background: #fff6e6; color: var(--warn); }
    .pill.info { border-color: rgba(36,84,214,0.24); background: var(--accent-soft); color: var(--accent-strong); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .status { min-height: 22px; font-size: 13px; color: var(--muted); }
    .status.error { color: var(--danger); }
    .status.ok { color: var(--ok); }
    .preview-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: start; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
    .preview-actions { justify-content: flex-end; }
    .brief { display: grid; gap: 12px; }
    .brief-title { font-size: 22px; font-weight: 760; color: var(--ink); line-height: 1.2; }
    .brief p, .brief li { color: var(--text); line-height: 1.5; }
    .brief ul { margin: 6px 0 0; padding-left: 20px; }
    .empty { min-height: 160px; display: grid; place-items: center; border: 1px dashed var(--border-strong); border-radius: 8px; color: var(--muted); text-align: center; padding: 18px; background: var(--panel-soft); }
    .proposal-pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid var(--border); background: #f8fafc; border-radius: 6px; padding: 12px; max-height: 280px; overflow: auto; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .context-summary { border: 1px solid var(--border); border-radius: 6px; padding: 12px; background: #f8fafc; display: grid; gap: 7px; }
    .context-summary strong { font-size: 13px; }
    .context-summary .gaps { color: var(--muted); font-size: 12px; line-height: 1.45; }
    details.debug-details { border: 1px solid var(--border); border-radius: 8px; background: #fff; }
    details.debug-details summary { cursor: pointer; padding: 11px 12px; color: var(--muted); font-size: 13px; font-weight: 680; }
    .result { white-space: pre-wrap; overflow-wrap: anywhere; background: #0f172a; color: #e5edf7; border-radius: 0 0 8px 8px; padding: 14px; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; max-height: 320px; overflow: auto; }
    .case-file { display: grid; grid-template-rows: auto 1fr; overflow: hidden; }
    .case-head { padding: 16px; border-bottom: 1px solid var(--border); background: #fbfcfe; display: grid; gap: 8px; }
    .case-grid { padding: 14px; display: grid; gap: 10px; align-content: start; overflow: auto; }
    .evidence-card { border: 1px solid var(--border); border-radius: 8px; background: #fff; padding: 12px; display: grid; gap: 7px; }
    .evidence-card strong { color: var(--ink); font-size: 13px; }
    .evidence-value { color: var(--text); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
    .copy-button { min-height: 28px; padding: 4px 8px; font-size: 11px; justify-self: start; }
    .audit-list { margin: 0; padding-left: 17px; color: var(--text); font-size: 12px; line-height: 1.5; }
    .showcase-note { display: none; border: 1px solid rgba(36,84,214,0.24); background: #f4f7ff; color: var(--accent-strong); border-radius: 8px; padding: 10px; font-size: 12px; line-height: 1.45; }
    .showcase-hero { display: none; padding: 22px; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%); }
    .showcase-hero-inner { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 22px; align-items: end; }
    .showcase-kicker { color: var(--accent-strong); font-size: 12px; font-weight: 780; text-transform: uppercase; }
    .showcase-title { margin-top: 7px; color: var(--ink); font-size: 36px; line-height: 1.04; font-weight: 780; }
    .showcase-copy { margin-top: 11px; max-width: 760px; color: #475569; font-size: 15px; line-height: 1.55; }
    .showcase-case-card { border: 1px solid var(--border); border-radius: 8px; background: #fff; padding: 14px; box-shadow: var(--shadow-soft); display: grid; gap: 10px; }
    .showcase-case-card strong { color: var(--ink); font-size: 15px; }
    .showcase-proof-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .proof-card { border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,0.84); padding: 12px; display: grid; gap: 5px; }
    .proof-card span { color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 760; }
    .proof-card strong { color: var(--ink); font-size: 14px; }
    .showcase-study { display: grid; gap: 14px; }
    .study-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: start; }
    .study-title { font-size: 26px; line-height: 1.12; font-weight: 780; color: var(--ink); }
    .study-summary { color: #475569; font-size: 14px; line-height: 1.55; max-width: 760px; }
    .study-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .study-card { border: 1px solid var(--border); border-radius: 8px; background: #fbfcfe; padding: 12px; display: grid; gap: 6px; }
    .study-card span { color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 760; }
    .study-card strong { color: var(--ink); font-size: 14px; overflow-wrap: anywhere; }
    .case-timeline { display: grid; gap: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; }
    .timeline-row { display: grid; grid-template-columns: 145px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-top: 1px solid var(--border); }
    .timeline-row:first-child { border-top: 0; }
    .timeline-row span { color: var(--muted); font-size: 12px; font-weight: 720; }
    .timeline-row strong { color: var(--ink); font-size: 13px; }
    body.showcase-mode .credential-panel,
    body.showcase-mode details.debug-details { display: none; }
    body.showcase-mode .showcase-note { display: block; }
    body.showcase-mode .empty { background: #fbfcfe; }
    body.showcase-mode main { width: min(1520px, calc(100vw - 28px)); }
    body.showcase-mode .app-shell { grid-template-columns: 246px minmax(0, 1fr) 360px; }
    body.showcase-mode .office-identity { padding: 20px; background: #fff; }
    body.showcase-mode .office-identity h1 { font-size: 20px; }
    body.showcase-mode .nav-footer,
    body.showcase-mode #deskQueuePanel,
    body.showcase-mode #commandApi { display: none; }
    body.showcase-mode .command-center { grid-template-rows: auto auto auto minmax(0, 1fr); }
    body.showcase-mode .command-bar { padding: 14px 20px; background: #fff; }
    body.showcase-mode .command-title p { display: none; }
    body.showcase-mode .command-actions { min-width: 180px; }
    body.showcase-mode .showcase-hero { display: block; }
    body.showcase-mode .lifecycle { background: #eef2f7; padding: 12px 18px; gap: 8px; border-bottom: 1px solid var(--border); }
    body.showcase-mode .life-step { min-height: 66px; border: 1px solid var(--border); border-radius: 8px; }
    body.showcase-mode .life-step.done { background: #f6fbf8; border-color: rgba(15,138,95,0.2); }
    body.showcase-mode .life-step.active { background: #eef4ff; border-color: rgba(36,84,214,0.36); box-shadow: inset 0 -3px 0 var(--accent); }
    body.showcase-mode .workspace-body { padding: 18px 20px 22px; }
    body.showcase-mode .work-panel { padding: 18px; border-color: rgba(186,195,208,0.85); box-shadow: var(--shadow-soft); }
    body.showcase-mode .preview-head,
    body.showcase-mode .approvalPanel { border-bottom-color: transparent; }
    body.showcase-mode .case-head { background: #fff; }
    body.showcase-mode .case-grid { gap: 12px; padding: 16px; }
    body.showcase-mode .evidence-card { padding: 14px; }
    body.showcase-mode .case-file .study-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @media (max-width: 1180px) {
      .app-shell { grid-template-columns: 230px minmax(0, 1fr); }
      body.showcase-mode .app-shell { grid-template-columns: 220px minmax(0, 1fr); }
      .case-file { grid-column: 1 / -1; }
      .case-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .showcase-hero-inner { grid-template-columns: 1fr; }
      .showcase-proof-grid, .study-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 860px) {
      main { width: min(100vw - 20px, 760px); margin-top: 20px; }
      .app-shell { grid-template-columns: 1fr; }
      .command-bar { grid-template-columns: 1fr; }
      .command-actions { justify-items: start; }
      .signal-row { justify-content: flex-start; }
      .lifecycle { grid-template-columns: repeat(4, minmax(120px, 1fr)); }
      .command-strip, .preview-head { grid-template-columns: 1fr; }
      .preview-head { flex-direction: column; }
      .preview-actions { justify-content: flex-start; }
      .case-grid { grid-template-columns: 1fr; }
      .showcase-proof-grid, .study-grid { grid-template-columns: 1fr; }
      .timeline-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <div class="app-shell">
      <aside class="office-nav" aria-label="Agent Office desks">
        <div class="office-identity">
          <div class="eyebrow">Agent Office</div>
          <h1>Agent Operations Command Center</h1>
          <p>Controlled AI software delivery with approvals, evidence, and review gates.</p>
        </div>
        <div class="nav-section">
          <div class="nav-label">Office desks</div>
          <div class="desk-nav" id="deskNav">
            <button class="desk-item" type="button" data-mode="architecture"><span class="desk-index">01</span><span><span class="desk-name">Architecture Desk</span><span class="desk-duty">Scope, constraints, system shape</span></span><span class="pill info" data-desk-count="architecture">0</span></button>
            <button class="desk-item" type="button" data-mode="codexHandoff"><span class="desk-index">02</span><span><span class="desk-name">Codex Handoff</span><span class="desk-duty">Implementation brief and guardrails</span></span><span class="pill" data-desk-count="codexHandoff">0</span></button>
            <button class="desk-item" type="button" data-mode="implementationReady"><span class="desk-index">03</span><span><span class="desk-name">Work-order PR</span><span class="desk-duty">Branch, work order, draft PR</span></span><span class="pill" data-desk-count="implementationReady">0</span></button>
            <button class="desk-item" type="button" data-mode="implementationReady" data-dispatch="true"><span class="desk-index">04</span><span><span class="desk-name">Codex Dispatch</span><span class="desk-duty">Agent implementation branch</span></span><span class="pill warn">PR #22</span></button>
            <button class="desk-item" type="button" data-mode="reviewDesk"><span class="desk-index">05</span><span><span class="desk-name">Review + Iteration</span><span class="desk-duty">Review verdict and fix brief</span></span><span class="pill" data-desk-count="reviewDesk">0</span></button>
            <button class="desk-item" type="button" data-mode="postMergeCloseout"><span class="desk-index">06</span><span><span class="desk-name">Post-Merge Closeout</span><span class="desk-duty">Deployment and Notion audit</span></span><span class="pill" data-desk-count="postMergeCloseout">0</span></button>
          </div>
        </div>
        <div class="nav-footer">
          <div class="field">
            <label for="deskMode">Desk selector</label>
            <select id="deskMode">
              <option value="architecture">Architecture Desk</option>
              <option value="codexHandoff">Codex Handoff Desk</option>
              <option value="implementationReady">Work-order PR</option>
              <option value="reviewDesk">Review + Iteration Desk</option>
              <option value="postMergeCloseout">Post-Merge Closeout</option>
            </select>
          </div>
          <div class="credential-panel">
            <label for="apiKey">API key</label>
            <input id="apiKey" type="password" autocomplete="off" placeholder="x-agent-office-api-key">
          </div>
          <div class="row">
            <button id="saveKeyButton">Use key</button>
            <button class="danger" id="clearButton">Clear</button>
          </div>
          <div class="status" id="globalStatus"></div>
        </div>
      </aside>

      <section class="command-center">
        <div class="command-bar">
          <div class="command-title">
            <div class="eyebrow">AI Development Office</div>
            <h1 id="commandTask">No active task</h1>
            <p>Command center for approval-gated Agent Office workflows.</p>
            <div class="command-meta">
              <span class="pill info" id="commandStage">Architecture Desk</span>
              <span class="pill mono" id="commandRepo">repo: pending</span>
              <span class="pill" id="commandEnv">env: local operator</span>
              <span class="pill warn" id="commandApi">api: key required</span>
            </div>
          </div>
          <div class="command-actions">
            <div class="signal-row">
              <span class="pill ok" id="notionSignal">Notion tracked</span>
              <span class="pill ok" id="githubSignal">GitHub evidence</span>
              <span class="pill ok" id="vercelSignal">Vercel monitored</span>
              <span class="pill info" id="codexSignal">Codex gated</span>
            </div>
            <label class="showcase-toggle" for="showcaseMode">
              <input id="showcaseMode" type="checkbox">
              <span>Showcase Mode</span>
            </label>
          </div>
        </div>

        <div class="showcase-hero" aria-label="Showcase overview">
          <div class="showcase-hero-inner">
            <div>
              <div class="showcase-kicker">Agent Office</div>
              <div class="showcase-title">Approval-gated AI delivery system</div>
              <p class="showcase-copy">A controlled workflow for turning product ideas into scoped briefs, Codex handoffs, draft PRs, review packets, and closeout records.</p>
            </div>
            <div class="showcase-case-card">
              <span class="pill info">Work-order PR ready</span>
              <strong>Codex Dispatch v0 - controlled implementation packet</strong>
              <div class="meta">
                <span class="pill mono">chief-of-staff-agent-office</span>
                <span class="pill mono">PR #22</span>
              </div>
              <span class="pill warn">Human approval required</span>
            </div>
          </div>
          <div class="showcase-proof-grid">
            <div class="proof-card"><span>Notion</span><strong>Task tracked</strong></div>
            <div class="proof-card"><span>GitHub</span><strong>Draft PR linked</strong></div>
            <div class="proof-card"><span>Vercel</span><strong>Preview ready</strong></div>
            <div class="proof-card"><span>Review</span><strong>Human gate visible</strong></div>
          </div>
        </div>

        <div class="lifecycle" aria-label="AI development lifecycle">
          <div class="life-step" data-stage="0"><span>Intake</span><span>Task captured</span></div>
          <div class="life-step" data-stage="1"><span>Architecture</span><span>Brief preview</span></div>
          <div class="life-step" data-stage="2"><span>Handoff</span><span>Codex packet</span></div>
          <div class="life-step" data-stage="3"><span>Work-order PR</span><span>Branch created</span></div>
          <div class="life-step" data-stage="4"><span>Codex Dispatch</span><span>Implementation</span></div>
          <div class="life-step" data-stage="5"><span>Review</span><span>Desk verdict</span></div>
          <div class="life-step" data-stage="6"><span>Merge</span><span>Human gate</span></div>
          <div class="life-step" data-stage="7"><span>Closeout</span><span>Audit recorded</span></div>
        </div>

        <div class="workspace-body">
          <div class="work-panel stack" id="deskQueuePanel">
            <div class="command-strip">
              <div class="section-heading">
                <h2>Desk Queue</h2>
                <p id="deskBrief">Choose a desk, load eligible tasks, and preview the next controlled action.</p>
              </div>
              <div class="row">
                <button id="loadTasksButton">Load tasks</button>
              </div>
            </div>
            <div class="showcase-note">Showcase Mode is using sanitized demo evidence. Live write actions are disabled and API credentials are hidden.</div>
            <div class="status" id="taskStatus"></div>
            <div class="tasks" id="taskList"></div>
            <div class="panel stack" id="reviewDeskInputs" hidden>
              <div>
                <label for="reviewRepo">Review repo</label>
                <input id="reviewRepo" autocomplete="off" placeholder="owner/name">
              </div>
              <div>
                <label for="reviewPrNumber">PR number</label>
                <input id="reviewPrNumber" inputmode="numeric" autocomplete="off" placeholder="20">
              </div>
            </div>
          </div>

          <div class="work-panel stack">
            <div class="preview-head">
              <div>
                <h2 id="selectedTaskTitle">Architect Brief Preview</h2>
                <p id="selectedTaskMeta">No task selected</p>
              </div>
              <div class="row preview-actions">
                <button id="previewButton" disabled>Preview</button>
                <button class="primary" id="approveButton" disabled>Approve writeback</button>
                <button id="githubPreviewButton" hidden disabled>Preview draft PR</button>
                <button class="primary" id="githubApproveButton" hidden disabled>Create draft PR</button>
                <button id="implementationPreviewButton" hidden disabled>Preview work order</button>
                <button class="primary" id="implementationApproveButton" hidden disabled>Create work-order PR</button>
                <button class="primary" id="closeoutCommitButton" hidden disabled>Commit closeout</button>
              </div>
            </div>
            <div class="status" id="previewStatus"></div>
            <div class="panel stack" id="revisionPanel" hidden>
              <div>
                <label for="revisionFeedback">Revision feedback</label>
                <textarea id="revisionFeedback" placeholder="Tell the Architect Desk what to tighten, remove, clarify, or refocus before approval."></textarea>
              </div>
              <div class="row">
                <button id="reviseButton" disabled>Revise preview</button>
              </div>
            </div>
            <div class="brief" id="briefPreview"><div class="empty">Select a ready task.</div></div>
            <div class="panel stack" id="approvalPanel" hidden>
              <div class="meta">
                <span class="pill" id="briefHash"></span>
                <span class="pill" id="expiresAt"></span>
              </div>
            </div>
            <details class="debug-details" id="debugDetails">
              <summary>Raw run output</summary>
              <div class="result" id="result"></div>
            </details>
          </div>
        </div>
      </section>

      <aside class="case-file" aria-label="Evidence and case file">
        <div class="case-head">
          <div class="eyebrow">Evidence / Case File</div>
          <h2>Auditable delivery context</h2>
          <p>Notion, GitHub, Vercel, Codex, approval gates, and missing evidence stay visible.</p>
        </div>
        <div class="case-grid" id="caseFile"></div>
      </aside>
    </div>
  </main>

  <script>
    const desks = {
      architecture: {
        approveEndpoint: "/agent-office/architect-review/approve",
        artifactKey: "brief",
        hashKey: "briefHash",
        previewButtonLabel: "Preview",
        previewEndpoint: "/agent-office/architect-review",
        previewTitle: "Architect Brief Preview",
        readyLabel: "Ready for Architecture",
        reviseEndpoint: "/agent-office/architect-review/revise",
        taskEndpoint: "/agent-office/tasks/ready-for-architecture",
        workflowName: "Architecture Desk"
      },
      codexHandoff: {
        approveEndpoint: "/agent-office/codex-handoff/approve",
        artifactKey: "handoff",
        hashKey: "handoffHash",
        previewButtonLabel: "Preview handoff",
        previewEndpoint: "/agent-office/codex-handoff",
        previewTitle: "Codex Handoff Preview",
        readyLabel: "Ready for Codex",
        taskEndpoint: "/agent-office/tasks/ready-for-codex",
        workflowName: "Codex Handoff Desk"
      },
      implementationReady: {
        previewButtonLabel: "Preview work order",
        previewTitle: "Controlled Implementation Preview",
        readyLabel: "In Codex / Implementation Ready",
        taskEndpoint: "/agent-office/tasks/implementation-ready",
        workflowName: "Implementation Ready"
      },
      reviewDesk: {
        previewButtonLabel: "Run review",
        previewTitle: "Review + Iteration Desk",
        readyLabel: "Implementation task",
        taskEndpoint: "/agent-office/tasks/implementation-ready",
        workflowName: "Review + Iteration Desk"
      },
      postMergeCloseout: {
        previewButtonLabel: "Preview closeout",
        previewTitle: "Post-Merge Closeout",
        readyLabel: "Implementation task",
        taskEndpoint: "/agent-office/tasks/implementation-ready",
        workflowName: "Post-Merge Closeout"
      }
    };

    const state = {
      apiKey: sessionStorage.getItem("agentOfficeApiKey") || "",
      approval: null,
      artifact: null,
      codexHandoffApprovalToken: null,
      githubApproval: null,
      githubProposal: null,
      implementationApproval: null,
      implementationProposal: null,
      mode: sessionStorage.getItem("agentOfficeDeskMode") || "architecture",
      postMergeCloseoutPreview: null,
      productContext: null,
      reviewDeskResult: null,
      revisionNumber: 0,
      selectedTask: null,
      showcaseMode: localStorage.getItem("agentOfficeShowcaseMode") === "true",
      tasks: []
    };

    if (state.mode === "implementation") {
      state.mode = "codexHandoff";
      sessionStorage.setItem("agentOfficeDeskMode", state.mode);
    }

    const apiKeyInput = document.getElementById("apiKey");
    const approveButton = document.getElementById("approveButton");
    const approvalPanel = document.getElementById("approvalPanel");
    const briefHash = document.getElementById("briefHash");
    const briefPreview = document.getElementById("briefPreview");
    const caseFile = document.getElementById("caseFile");
    const clearButton = document.getElementById("clearButton");
    const closeoutCommitButton = document.getElementById("closeoutCommitButton");
    const commandApi = document.getElementById("commandApi");
    const commandEnv = document.getElementById("commandEnv");
    const commandRepo = document.getElementById("commandRepo");
    const commandStage = document.getElementById("commandStage");
    const commandTask = document.getElementById("commandTask");
    const debugDetails = document.getElementById("debugDetails");
    const deskMode = document.getElementById("deskMode");
    const deskBrief = document.getElementById("deskBrief");
    const deskNavButtons = Array.from(document.querySelectorAll(".desk-item"));
    const expiresAt = document.getElementById("expiresAt");
    const githubApproveButton = document.getElementById("githubApproveButton");
    const githubPreviewButton = document.getElementById("githubPreviewButton");
    const implementationApproveButton = document.getElementById("implementationApproveButton");
    const implementationPreviewButton = document.getElementById("implementationPreviewButton");
    const globalStatus = document.getElementById("globalStatus");
    const loadTasksButton = document.getElementById("loadTasksButton");
    const previewButton = document.getElementById("previewButton");
    const previewStatus = document.getElementById("previewStatus");
    const result = document.getElementById("result");
    const reviseButton = document.getElementById("reviseButton");
    const revisionFeedback = document.getElementById("revisionFeedback");
    const revisionPanel = document.getElementById("revisionPanel");
    const reviewDeskInputs = document.getElementById("reviewDeskInputs");
    const reviewPrNumber = document.getElementById("reviewPrNumber");
    const reviewRepo = document.getElementById("reviewRepo");
    const saveKeyButton = document.getElementById("saveKeyButton");
    const selectedTaskMeta = document.getElementById("selectedTaskMeta");
    const selectedTaskTitle = document.getElementById("selectedTaskTitle");
    const showcaseMode = document.getElementById("showcaseMode");
    const taskList = document.getElementById("taskList");
    const taskStatus = document.getElementById("taskStatus");
    const lifecycleSteps = Array.from(document.querySelectorAll(".life-step"));

    const showcaseCase = {
      approvalHash: "handoff:8f31c72a4b19",
      auditTrail: [
        "Task captured.",
        "Architecture approved.",
        "Handoff generated.",
        "Work-order PR created.",
        "Dispatch packet ready."
      ],
      branch: "codex/add-codex-dispatch-v0",
      latestRunId: "run_20260604_1438_codex_dispatch",
      missingEvidence: ["Human smoke test pending."],
      notionTask: "Codex Dispatch v0 - controlled implementation packet",
      pr: "SherifHaidar/chief-of-staff-agent-office#22",
      repo: "SherifHaidar/chief-of-staff-agent-office",
      reviewVerdict: "Pending",
      stageIndex: 4,
      vercelStatus: "Preview ready",
      workOrderPath: ".agent-office/work-orders/add-codex-dispatch-v0.md"
    };

    const showcaseTask = {
      name: showcaseCase.notionTask,
      priority: "High",
      status: "Work-order PR ready",
      taskId: "notion-demo-add-codex-dispatch-v0"
    };

    apiKeyInput.value = state.apiKey;
    deskMode.value = desks[state.mode] ? state.mode : "architecture";
    state.mode = deskMode.value;
    resetSelection();
    setShowcaseMode(state.showcaseMode);

    function activeDesk() {
      return desks[state.mode];
    }

    function isArchitectureMode() {
      return state.mode === "architecture";
    }

    function isCodexHandoffMode() {
      return state.mode === "codexHandoff";
    }

    function isImplementationReadyMode() {
      return state.mode === "implementationReady";
    }

    function isReviewDeskMode() {
      return state.mode === "reviewDesk";
    }

    function isPostMergeCloseoutMode() {
      return state.mode === "postMergeCloseout";
    }

    function activeStageIndex() {
      if (state.showcaseMode) {
        return showcaseCase.stageIndex;
      }
      if (isArchitectureMode()) {
        return state.artifact ? 1 : 0;
      }
      if (isCodexHandoffMode()) {
        return state.githubProposal ? 3 : state.artifact ? 2 : 1;
      }
      if (isImplementationReadyMode()) {
        return state.implementationProposal ? 4 : 3;
      }
      if (isReviewDeskMode()) {
        return state.reviewDeskResult ? 5 : 4;
      }
      if (isPostMergeCloseoutMode()) {
        return state.postMergeCloseoutPreview ? 7 : 6;
      }
      return 0;
    }

    function currentCaseData() {
      if (state.showcaseMode) {
        return showcaseCase;
      }

      const task = state.selectedTask;
      const proposal = state.implementationProposal || state.githubProposal;
      const closeout = state.postMergeCloseoutPreview;
      const review = state.reviewDeskResult;
      const closeoutPr = closeout && closeout.evidence ? closeout.evidence.pullRequest : null;
      const reviewPr = review && review.evidence ? review.evidence.pullRequest : null;

      return {
        approvalHash: state.approval ? "approval ready" : "pending preview",
        auditTrail: [
          task ? "Task selected from " + activeDesk().workflowName + "." : "No task selected.",
          state.artifact ? "Preview generated and waiting on approval boundary." : "Preview not generated.",
          proposal ? "GitHub proposal available for review." : "GitHub proposal pending.",
          review ? "Review Desk verdict returned." : "Review Desk verdict pending."
        ],
        branch: proposal ? proposal.branchName : "pending",
        latestRunId: "pending",
        missingEvidence: review && review.review ? review.review.missingEvidence : ["Select a task and generate a preview to populate evidence."],
        notionTask: task ? task.name : "No active Notion task",
        pr: closeoutPr ? closeoutPr.repository + "#" + closeoutPr.pullRequestNumber : reviewPr ? reviewPr.repository + "#" + reviewPr.pullRequestNumber : "pending",
        repo: proposal ? proposal.repository : closeoutPr ? closeoutPr.repository : reviewPr ? reviewPr.repository : "pending",
        reviewVerdict: review && review.review ? review.review.verdict : "Not reviewed",
        stageIndex: activeStageIndex(),
        vercelStatus: closeout && closeout.evidence && closeout.evidence.deployment ? closeout.evidence.deployment.status : "pending",
        workOrderPath: state.implementationProposal ? state.implementationProposal.workOrderPath : "pending"
      };
    }

    function syncControlsForMode() {
      previewButton.hidden = isImplementationReadyMode();
      approveButton.hidden = isImplementationReadyMode() || isReviewDeskMode() || isPostMergeCloseoutMode();
      githubPreviewButton.hidden = !isCodexHandoffMode();
      githubApproveButton.hidden = !isCodexHandoffMode();
      implementationPreviewButton.hidden = !isImplementationReadyMode();
      implementationApproveButton.hidden = !isImplementationReadyMode();
      closeoutCommitButton.hidden = !isPostMergeCloseoutMode();
      reviewDeskInputs.hidden = !(isReviewDeskMode() || isPostMergeCloseoutMode());
      reviewRepo.previousElementSibling.textContent = isPostMergeCloseoutMode() ? "Closeout repo" : "Review repo";
      previewButton.textContent = activeDesk().previewButtonLabel;
      approveButton.disabled = approveButton.disabled || state.showcaseMode;
      githubApproveButton.disabled = githubApproveButton.disabled || state.showcaseMode;
      implementationApproveButton.disabled = implementationApproveButton.disabled || state.showcaseMode;
      closeoutCommitButton.disabled = closeoutCommitButton.disabled || state.showcaseMode;
      updateCommandCenter();
    }

    function setStatus(element, message, type) {
      element.textContent = message;
      element.className = ("status " + (type || "")).trim();
    }

    function updateCommandCenter() {
      const desk = activeDesk();
      const caseData = currentCaseData();
      const activeStage = activeStageIndex();

      commandTask.textContent = state.selectedTask ? state.selectedTask.name : state.showcaseMode ? showcaseCase.notionTask : "No active task";
      commandStage.textContent = desk.workflowName;
      commandRepo.textContent = "repo: " + caseData.repo;
      commandEnv.textContent = state.showcaseMode ? "env: sanitized preview" : "env: local operator";
      commandApi.textContent = state.showcaseMode ? "api: hidden" : state.apiKey || apiKeyInput.value.trim() ? "api: ready" : "api: key required";
      commandApi.className = "pill " + (state.showcaseMode || state.apiKey || apiKeyInput.value.trim() ? "ok" : "warn");
      deskBrief.textContent = desk.readyLabel + " queue. " + (state.showcaseMode ? "Demo evidence is loaded for portfolio review." : "Load eligible tasks, inspect evidence, then run the next gated preview.");

      deskNavButtons.forEach(function (button) {
        const isDispatch = button.dataset.dispatch === "true";
        const isWorkOrderBeforeDispatch = state.mode === "implementationReady" && activeStage >= 4 && !isDispatch;
        const isActive = button.dataset.mode === state.mode && !isWorkOrderBeforeDispatch && (!isDispatch || activeStage >= 4);
        button.classList.toggle("active", isActive);
      });

      lifecycleSteps.forEach(function (step) {
        const index = Number(step.dataset.stage || "0");
        step.classList.toggle("done", index < activeStage);
        step.classList.toggle("active", index === activeStage);
      });

      document.querySelectorAll("[data-desk-count]").forEach(function (element) {
        const mode = element.getAttribute("data-desk-count");
        const count = state.showcaseMode && mode === state.mode ? 1 : mode === state.mode ? state.tasks.length : 0;
        element.textContent = String(count);
        element.className = "pill " + (count > 0 ? "info" : "");
      });

      renderCaseFile();
    }

    function renderCaseFile() {
      const data = currentCaseData();
      if (state.showcaseMode) {
        caseFile.innerHTML = [
          '<div class="evidence-card"><strong>Proof signals</strong><div class="study-grid">',
          '<div class="study-card"><span>Notion task</span><strong>Tracked</strong></div>',
          '<div class="study-card"><span>GitHub PR</span><strong class="mono">#22 linked</strong></div>',
          '<div class="study-card"><span>Vercel preview</span><strong>Ready</strong></div>',
          '<div class="study-card"><span>Review Desk</span><strong>Pending</strong></div>',
          '</div></div>',
          '<div class="evidence-card"><strong>Case identifiers</strong><div class="evidence-value mono">repo: chief-of-staff-agent-office</div><div class="evidence-value mono">branch: ' + escapeHtml(data.branch) + '</div><div class="evidence-value mono">work-order: ' + escapeHtml(data.workOrderPath) + '</div><button class="copy-button" type="button" data-copy="' + escapeHtml(data.workOrderPath) + '">Copy work-order path</button></div>',
          '<div class="evidence-card"><strong>Approval boundary</strong><div class="evidence-value">Human approval required before dispatch, merge, deploy, or closeout. Approval hash is previewed and redacted for the public demo state.</div><div class="meta"><span class="pill warn">approval redacted</span><span class="pill info">writes disabled</span></div></div>',
          '<div class="evidence-card"><strong>Missing evidence / risk</strong><ul class="audit-list"><li>Human smoke test pending.</li><li>Review Desk packet awaits final verification notes.</li></ul></div>',
          '<div class="evidence-card"><strong>Audit trail</strong><ul class="audit-list"><li>Task captured</li><li>Architecture approved</li><li>Handoff generated</li><li>Work-order PR created</li><li>Dispatch packet ready</li></ul></div>'
        ].join("");

        caseFile.querySelectorAll("[data-copy]").forEach(function (button) {
          button.addEventListener("click", function () {
            copyText(button.getAttribute("data-copy") || "");
          });
        });
        return;
      }

      const cards = [
        ["Notion task", data.notionTask, "Notion evidence is the source of task state."],
        ["GitHub PR", data.pr, "Pull request evidence and review context."],
        ["Repository", data.repo, "Target repo for this controlled workflow."],
        ["Branch", data.branch, "Implementation or work-order branch."],
        ["Work-order path", data.workOrderPath, "Auditable instruction file for Codex."],
        ["Vercel status", data.vercelStatus, "Deployment or preview signal."],
        ["Latest run ID", data.latestRunId, "Traceable Agent Office execution."],
        ["Review Desk verdict", data.reviewVerdict, "Independent review and iteration state."],
        ["Approval hash", data.approvalHash, "Preview token evidence without exposing secrets."]
      ];

      caseFile.innerHTML = cards.map(function (card) {
        const value = card[1] || "pending";
        return '<div class="evidence-card"><strong>' + escapeHtml(card[0]) + '</strong><div class="evidence-value mono">' + escapeHtml(value) + '</div><p>' + escapeHtml(card[2]) + '</p><button class="copy-button" type="button" data-copy="' + escapeHtml(value) + '">Copy</button></div>';
      }).join("") +
        '<div class="evidence-card"><strong>Missing evidence / risks</strong><ul class="audit-list">' + (data.missingEvidence || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ul></div>' +
        '<div class="evidence-card"><strong>Audit trail</strong><ul class="audit-list">' + (data.auditTrail || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ul></div>';

      caseFile.querySelectorAll("[data-copy]").forEach(function (button) {
        button.addEventListener("click", function () {
          copyText(button.getAttribute("data-copy") || "");
        });
      });
    }

    function copyText(value) {
      if (!value || value === "pending") {
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {});
      }
    }

    function setShowcaseMode(enabled) {
      state.showcaseMode = enabled;
      document.body.classList.toggle("showcase-mode", enabled);
      showcaseMode.checked = enabled;
      localStorage.setItem("agentOfficeShowcaseMode", enabled ? "true" : "false");
      if (enabled) {
        apiKeyInput.value = "";
        state.apiKey = "";
        state.mode = "implementationReady";
        deskMode.value = state.mode;
        state.tasks = [showcaseTask];
        state.selectedTask = showcaseTask;
        state.implementationProposal = {
          baseBranch: "main",
          baseCommitSha: "d5b7d0226e7b970086a7a9059c785affa719e687",
          branchName: showcaseCase.branch,
          handoffSummary: {
            acceptanceChecklist: ["Codex Dispatch accepts an approved work-order", "Operator can inspect prompt before dispatch", "Review Desk can request fixes without merge authority"],
            constraints: ["Do not change approval-token logic", "Do not merge or deploy automatically", "Keep GitHub, Notion, and Vercel integrations permissioned"],
            implementationScope: ["Add dispatch preparation surface", "Preserve human approval gates", "Record auditable evidence"],
            implementationSteps: ["Prepare dispatch prompt", "Attach work-order evidence", "Route to Review Desk after implementation"],
            likelyAffectedFiles: ["src/server/operator-console-page.ts", "tests/server/app.test.ts"],
            problemSummary: "Move approved work orders into a controlled Codex implementation lane.",
            productIntent: "Make agent work observable, gated, and reviewable.",
            testsToRun: ["npm run typecheck", "npm test"]
          },
          nextAction: "Dispatch Codex on the work-order branch after human approval.",
          prBody: "Portfolio demo state. No live GitHub write is performed in Showcase Mode.",
          prTitle: "Add Codex Dispatch v0",
          repository: showcaseCase.repo,
          workOrderContent: "Controlled work order for Codex Dispatch v0.",
          workOrderPath: showcaseCase.workOrderPath
        };
        state.reviewDeskResult = {
          evidence: { pullRequest: { pullRequestNumber: 22, repository: showcaseCase.repo } },
          finalApprovalWarning: "Review can request Codex fixes, but cannot merge or deploy.",
          review: {
            acceptanceChecklist: [
              { criterion: "Approval gate preserved", notes: "Dispatch is disabled without a human-approved work order.", status: "Pass" },
              { criterion: "Evidence attached", notes: "Repo, branch, PR, run ID, and Vercel preview are visible.", status: "Pass" },
              { criterion: "Smoke notes", notes: "Manual verification notes are still missing.", status: "Needs follow-up" }
            ],
            codexFixBrief: { instructions: ["Tighten empty-state copy", "Add final smoke-test evidence"], summary: "Small follow-up before closeout.", verification: ["Rerun typecheck", "Rerun tests"] },
            missingEvidence: showcaseCase.missingEvidence,
            risks: ["Operator may confuse preview with write action unless the boundary stays visible."],
            suggestedSmokeTests: ["Open /office with Showcase Mode", "Verify write actions remain disabled", "Confirm evidence panel contains sanitized identifiers"],
            summary: "Codex Dispatch is directionally correct and auditable; final smoke evidence is still required.",
            verdict: showcaseCase.reviewVerdict
          }
        };
        syncControlsForMode();
        renderTasks();
        selectTask(showcaseTask);
        renderImplementationProposal(state.implementationProposal);
        implementationApproveButton.disabled = true;
        setStatus(globalStatus, "Showcase Mode on. Live writes disabled.", "ok");
        setStatus(taskStatus, "Demo queue loaded with sanitized evidence.", "ok");
        setStatus(previewStatus, "Demo work order ready. Write actions are disabled.", "ok");
      } else if (globalStatus.textContent === "Showcase view on.") {
        setStatus(globalStatus, "");
      }
      if (!enabled && globalStatus.textContent === "Showcase Mode on. Live writes disabled.") {
        setStatus(globalStatus, "");
      }
      updateCommandCenter();
      renderCaseFile();
    }

    function requireKey() {
      const key = apiKeyInput.value.trim();
      if (!key) {
        throw new Error("API key required.");
      }
      state.apiKey = key;
      sessionStorage.setItem("agentOfficeApiKey", key);
      return key;
    }

    async function agentFetch(path, options) {
      const requestOptions = options || {};
      const headers = new Headers(requestOptions.headers || {});
      headers.set("x-agent-office-api-key", requireKey());
      const response = await fetch(path, Object.assign({}, requestOptions, { headers: headers }));
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Request failed with " + response.status);
      }
      return payload;
    }

    function resetSelection() {
      const desk = activeDesk();
      state.approval = null;
      state.artifact = null;
      state.codexHandoffApprovalToken = null;
      state.githubApproval = null;
      state.githubProposal = null;
      state.implementationApproval = null;
      state.implementationProposal = null;
      state.postMergeCloseoutPreview = null;
      state.productContext = null;
      state.reviewDeskResult = null;
      state.revisionNumber = 0;
      state.selectedTask = null;
      state.tasks = [];
      selectedTaskTitle.textContent = desk.previewTitle;
      selectedTaskMeta.textContent = "No task selected";
      syncControlsForMode();
      previewButton.disabled = true;
      approveButton.disabled = true;
      approvalPanel.hidden = true;
      result.hidden = true;
      githubPreviewButton.disabled = true;
      githubApproveButton.disabled = true;
      implementationPreviewButton.disabled = true;
      implementationApproveButton.disabled = true;
      closeoutCommitButton.disabled = true;
      revisionFeedback.value = "";
      revisionPanel.hidden = true;
      reviseButton.disabled = true;
      taskList.innerHTML = "";
      briefPreview.innerHTML = '<div class="empty">Select a ' + escapeHtml(desk.readyLabel) + ' task.</div>';
      debugDetails.hidden = true;
      result.textContent = "";
      setStatus(previewStatus, "");
      setStatus(taskStatus, "");
      updateCommandCenter();
    }

    function renderTasks() {
      taskList.innerHTML = "";
      if (state.tasks.length === 0) {
        taskList.innerHTML = '<div class="empty">No ready tasks.</div>';
        updateCommandCenter();
        return;
      }

      state.tasks.forEach(function (task) {
        const button = document.createElement("button");
        const priority = task.priority === undefined ? "" : '<span class="pill">Priority ' + escapeHtml(String(task.priority)) + '</span>';
        button.className = "task";
        button.innerHTML = '<strong>' + escapeHtml(task.name) + '</strong><span class="meta"><span class="pill">' + escapeHtml(task.status) + '</span>' + priority + '</span>';
        button.addEventListener("click", function () { selectTask(task); });
        taskList.appendChild(button);
      });
      updateCommandCenter();
    }

    function selectTask(task) {
      state.selectedTask = task;
      if (!state.showcaseMode) {
        state.approval = null;
        state.artifact = null;
        state.codexHandoffApprovalToken = null;
        state.githubApproval = null;
        state.githubProposal = null;
        state.implementationApproval = null;
        state.implementationProposal = null;
        state.postMergeCloseoutPreview = null;
        state.productContext = null;
        state.reviewDeskResult = null;
        state.revisionNumber = 0;
      }
      selectedTaskTitle.textContent = task.name;
      selectedTaskMeta.textContent = task.status + " / " + task.taskId;
      syncControlsForMode();
      previewButton.disabled = isImplementationReadyMode();
      approveButton.disabled = true;
      githubPreviewButton.disabled = true;
      githubApproveButton.disabled = true;
      implementationPreviewButton.disabled = !isImplementationReadyMode();
      implementationApproveButton.disabled = true;
      closeoutCommitButton.disabled = true;
      approvalPanel.hidden = true;
      revisionFeedback.value = "";
      revisionPanel.hidden = true;
      reviseButton.disabled = true;
      result.hidden = true;
      debugDetails.hidden = true;
      result.textContent = "";
      briefPreview.innerHTML = '<div class="empty">Preview not generated.</div>';
      setStatus(previewStatus, "");
      updateCommandCenter();
    }

    function renderArtifact(artifact) {
      if (isReviewDeskMode()) {
        renderReviewDeskResult(artifact);
        return;
      }

      if (isPostMergeCloseoutMode()) {
        renderPostMergeCloseoutResult(artifact);
        return;
      }

      if (isCodexHandoffMode()) {
        renderCodexHandoff(artifact);
        return;
      }

      renderArchitectBrief(artifact);
    }

    function renderArchitectBrief(brief) {
      const contextSummary = renderContextSummary(state.productContext);
      const sections = [
        ["Recommended Architecture", brief.recommendedArchitecture],
        ["File Structure", brief.fileStructure],
        ["Dependencies", brief.dependencies],
        ["Configuration", brief.configuration],
        ["Implementation Plan", brief.implementationPlan],
        ["Risks", brief.risks],
        ["Open Questions", brief.openQuestions]
      ];

      briefPreview.innerHTML = contextSummary + '<div class="brief-title">' + escapeHtml(brief.briefTitle) + '</div><p>' + escapeHtml(brief.executiveSummary) + '</p>' + sections.map(function (section) {
        return renderList(section[0], section[1]);
      }).join("");
      updateCommandCenter();
    }

    function renderCodexHandoff(handoff) {
      const contextSummary = renderContextSummary(state.productContext);
      const sections = [
        ["Implementation Scope", handoff.implementationScope],
        ["Likely Affected Files or Modules", handoff.likelyAffectedFiles],
        ["Constraints / Do Not Change", handoff.constraints],
        ["Implementation Steps", handoff.implementationSteps],
        ["Tests to Run", handoff.testsToRun],
        ["Acceptance Checklist", handoff.acceptanceChecklist],
        ["Merge / Deploy Approval Warnings", handoff.explicitApprovalWarnings]
      ];

      briefPreview.innerHTML = [
        contextSummary,
        '<div class="brief-title">' + escapeHtml(handoff.suggestedPrTitle) + '</div>',
        '<p><strong>Target repo:</strong> ' + escapeHtml(handoff.targetProductRepo) + '</p>',
        '<p><strong>Suggested branch:</strong> ' + escapeHtml(handoff.suggestedBranchName) + '</p>',
        '<h3>Problem Summary</h3><p>' + escapeHtml(handoff.problemSummary) + '</p>',
        '<h3>Product Intent</h3><p>' + escapeHtml(handoff.productIntent) + '</p>',
        sections.map(function (section) { return renderList(section[0], section[1]); }).join(""),
        '<h3>Suggested PR Body</h3><p>' + escapeHtml(handoff.suggestedPrBody) + '</p>'
      ].join("");
      updateCommandCenter();
    }

    function renderReviewDeskResult(result) {
      const review = result.review;
      const evidence = result.evidence;
      briefPreview.innerHTML = [
        '<div class="brief-title">' + escapeHtml(review.verdict) + '</div>',
        '<p>' + escapeHtml(review.summary) + '</p>',
        '<p><strong>PR:</strong> ' + escapeHtml(evidence.pullRequest.repository) + '#' + escapeHtml(evidence.pullRequest.pullRequestNumber) + '</p>',
        '<p><strong>Approval boundary:</strong> ' + escapeHtml(result.finalApprovalWarning) + '</p>',
        renderList('Deterministic Gates', (evidence.policyFindings || []).map(function (finding) { return finding.severity + ': ' + finding.message; })),
        renderList('Risks', review.risks),
        renderList('Missing Evidence', review.missingEvidence),
        renderList('Acceptance Checklist', (review.acceptanceChecklist || []).map(function (item) { return item.status + ': ' + item.criterion + ' - ' + item.notes; })),
        renderList('Suggested Smoke Tests', review.suggestedSmokeTests),
        review.verdict === 'Needs Codex Fixes' && review.codexFixBrief ? '<h3>Draft Codex Fix Brief</h3><p>' + escapeHtml(review.codexFixBrief.summary) + '</p>' + renderList('Fix Instructions', review.codexFixBrief.instructions) + renderList('Verification', review.codexFixBrief.verification) : ''
      ].join("");
      updateCommandCenter();
    }

    function renderPostMergeCloseoutResult(closeout) {
      const evidence = closeout.evidence;
      const pr = evidence.pullRequest;
      const plan = closeout.plan;
      const writes = closeout.committed ? closeout.propertyWrites : plan.propertyWrites;
      const deploymentSummary = evidence.deployment.status === "found"
        ? evidence.deployment.deployments.map(function (deployment) {
            return (deployment.environment || "deployment") + ": " + (deployment.state || "unknown") + (deployment.url ? " - " + deployment.url : "");
          })
        : [evidence.deployment.status + ": " + (evidence.deployment.message || "No deployment evidence.")];
      const writeSummary = writes.map(function (write) {
        return write.name + ": " + write.status + (write.value !== undefined ? " -> " + write.value : "") + (write.reason ? " (" + write.reason + ")" : "");
      });

      briefPreview.innerHTML = [
        '<div class="brief-title">' + escapeHtml(closeout.committed ? "Committed closeout" : "Preview closeout") + '</div>',
        '<p><strong>PR:</strong> ' + escapeHtml(pr.repository) + '#' + escapeHtml(pr.pullRequestNumber) + '</p>',
        '<p><strong>Selected task update:</strong> Selected task will be updated with closeout evidence for ' + escapeHtml(pr.repository) + '#' + escapeHtml(pr.pullRequestNumber) + '.</p>',
        '<p><strong>Task PR Link check:</strong> ' + escapeHtml(plan.taskPrLinkCheck ? plan.taskPrLinkCheck.message : "No task PR Link check returned.") + '</p>',
        '<p><strong>Merged:</strong> ' + escapeHtml(pr.mergedAt) + ' by ' + escapeHtml(pr.mergedBy || "unknown") + '</p>',
        '<p><strong>Merge SHA:</strong> ' + escapeHtml(pr.mergeSha) + '</p>',
        '<p><strong>Idempotency marker:</strong> ' + escapeHtml(plan.closeoutMarker) + '</p>',
        '<p><strong>Notion write:</strong> ' + escapeHtml(closeout.committed ? (closeout.blockAppended ? "Properties written and closeout block appended." : "Properties written; closeout block already existed and was not duplicated.") : "Preview only. No Notion writes performed.") + '</p>',
        renderList('Deployment Evidence', deploymentSummary),
        renderList('Notion Property Writes', writeSummary),
        renderList('Diagnostics', Object.values(closeout.diagnostics || {})),
        '<h3>Closeout Block Preview</h3><pre class="proposal-pre">' + escapeHtml(plan.blockPreview) + '</pre>',
        '<h3>Approval Boundary</h3><p>Post-Merge Closeout records an already-merged PR. It does not merge, deploy, approve production, or dispatch Codex fixes.</p>'
      ].join("");
      updateCommandCenter();
    }

    function renderContextSummary(productContext) {
      if (!productContext) {
        return '<div class="context-summary"><strong>Product context</strong><div class="meta"><span class="pill">Not included</span></div><div class="gaps">No Product Context Pack summary was returned for this preview.</div></div>';
      }

      const gaps = productContext.contextGaps && productContext.contextGaps.length > 0
        ? '<div class="gaps">' + productContext.contextGaps.map(escapeHtml).join('<br>') + '</div>'
        : '<div class="gaps">No context gaps reported.</div>';
      const pills = [
        productContext.included ? 'Included' : 'Not included',
        productContext.notionIncluded ? 'Notion product context' : 'No Notion context',
        productContext.repoIncluded ? String(productContext.fileCount || 0) + ' repo files' : 'No repo files',
        productContext.baseCommitSha ? 'Base ' + productContext.baseCommitSha.slice(0, 7) : ''
      ].filter(Boolean).map(function (item) {
        return '<span class="pill">' + escapeHtml(item) + '</span>';
      }).join('');

      return '<div class="context-summary"><strong>Product context</strong><div class="meta">' + pills + '</div>' + gaps + '</div>';
    }

    function renderGitHubProposal(proposal) {
      briefPreview.innerHTML = [
        '<div class="brief-title">' + escapeHtml(proposal.prTitle) + '</div>',
        '<p><strong>Controlled action:</strong> prepare a draft PR proposal from an approved Codex Handoff. Human approval is required before GitHub writes.</p>',
        '<p><strong>Repository:</strong> ' + escapeHtml(proposal.repository) + '</p>',
        '<p><strong>Base:</strong> ' + escapeHtml(proposal.baseBranch) + ' @ ' + escapeHtml(proposal.baseCommitSha) + '</p>',
        '<p><strong>Branch:</strong> ' + escapeHtml(proposal.branchName) + '</p>',
        '<p><strong>File:</strong> ' + escapeHtml(proposal.handoffFilePath) + '</p>',
        '<p><strong>Commit:</strong> ' + escapeHtml(proposal.commitMessage) + '</p>',
        '<details><summary>Draft PR body</summary><pre class="proposal-pre">' + escapeHtml(proposal.prBody) + '</pre></details>',
        '<details><summary>Handoff file content</summary><pre class="proposal-pre">' + escapeHtml(proposal.handoffFileContent) + '</pre></details>',
        '<h3>Approval Boundary</h3><p>Draft only. This will not merge, deploy, push to main, or change repo settings/secrets.</p>'
      ].join("");
      updateCommandCenter();
    }

    function renderImplementationProposal(proposal) {
      if (state.showcaseMode) {
        renderShowcaseStudy(proposal);
        return;
      }

      briefPreview.innerHTML = [
        '<div class="brief-title">' + escapeHtml(proposal.prTitle) + '</div>',
        '<p><strong>Implementation pending:</strong> this is the starting point for Codex implementation, not the final deliverable.</p>',
        '<p><strong>Repository:</strong> ' + escapeHtml(proposal.repository) + '</p>',
        '<p><strong>Base:</strong> ' + escapeHtml(proposal.baseBranch) + ' @ ' + escapeHtml(proposal.baseCommitSha) + '</p>',
        '<p><strong>Branch:</strong> ' + escapeHtml(proposal.branchName) + '</p>',
        '<p><strong>Work order:</strong> ' + escapeHtml(proposal.workOrderPath) + '</p>',
        '<h3>Next Action</h3><p>' + escapeHtml(proposal.nextAction) + '</p>',
        '<h3>Approved Handoff Summary</h3>',
        '<p><strong>Problem:</strong> ' + escapeHtml(proposal.handoffSummary.problemSummary) + '</p>',
        '<p><strong>Product intent:</strong> ' + escapeHtml(proposal.handoffSummary.productIntent) + '</p>',
        renderList('Implementation Scope', proposal.handoffSummary.implementationScope),
        renderList('Likely Affected Files or Modules', proposal.handoffSummary.likelyAffectedFiles),
        renderList('Constraints / Do Not Change', proposal.handoffSummary.constraints),
        renderList('Implementation Steps', proposal.handoffSummary.implementationSteps),
        renderList('Tests To Run', proposal.handoffSummary.testsToRun),
        renderList('Acceptance Checklist', proposal.handoffSummary.acceptanceChecklist),
        '<details><summary>PR body</summary><pre class="proposal-pre">' + escapeHtml(proposal.prBody) + '</pre></details>',
        '<details><summary>Work order content</summary><pre class="proposal-pre">' + escapeHtml(proposal.workOrderContent) + '</pre></details>',
        '<h3>Approval Boundary</h3><p>Draft only. Agent Office will commit only this work-order file. Product implementation must happen later on the created branch; this will not merge, deploy, push to main, or change repo settings/secrets.</p>'
      ].join("");
      updateCommandCenter();
    }

    function renderShowcaseStudy(proposal) {
      briefPreview.innerHTML = [
        '<div class="showcase-study">',
        '<div class="study-head"><div><div class="study-title">Codex Dispatch v0 - controlled implementation packet</div><p class="study-summary">Agent Office turns a Notion-tracked product request into an architecture brief, Codex handoff, work-order PR, dispatch packet, review loop, human merge gate, and closeout record. This demo state is sanitized and safe for portfolio screenshots.</p></div><span class="pill warn">Human approval required</span></div>',
        '<div class="study-grid">',
        '<div class="study-card"><span>Status</span><strong>Work-order PR ready</strong></div>',
        '<div class="study-card"><span>Repository</span><strong class="mono">chief-of-staff-agent-office</strong></div>',
        '<div class="study-card"><span>Pull request</span><strong class="mono">#22</strong></div>',
        '<div class="study-card"><span>Branch</span><strong class="mono">' + escapeHtml(proposal.branchName) + '</strong></div>',
        '<div class="study-card"><span>Work-order path</span><strong class="mono">' + escapeHtml(proposal.workOrderPath) + '</strong></div>',
        '<div class="study-card"><span>Approval hash</span><strong class="mono">previewed / redacted</strong></div>',
        '</div>',
        '<div class="case-timeline">',
        '<div class="timeline-row"><span>01 Intake</span><strong>Notion task captured</strong><span class="pill ok">Tracked</span></div>',
        '<div class="timeline-row"><span>02 Architecture</span><strong>Brief approved with scope, risks, constraints, and acceptance criteria</strong><span class="pill ok">Approved</span></div>',
        '<div class="timeline-row"><span>03 Codex Handoff</span><strong>Implementation packet generated with explicit do-not-change boundaries</strong><span class="pill ok">Generated</span></div>',
        '<div class="timeline-row"><span>04 Work-order PR</span><strong>Draft PR and sanitized work-order file prepared for dispatch</strong><span class="pill info">Ready</span></div>',
        '<div class="timeline-row"><span>05 Codex Dispatch</span><strong>Agent implementation can begin only after human approval</strong><span class="pill warn">Gated</span></div>',
        '<div class="timeline-row"><span>06 Review</span><strong>Review Desk packet pending smoke evidence before closeout</strong><span class="pill">Pending</span></div>',
        '</div>',
        '<h3>Approval Boundary</h3><p>Showcase Mode never performs live writes. It hides credentials, disables write actions, sanitizes raw output, and presents a representative delivery case.</p>',
        '</div>'
      ].join("");
      updateCommandCenter();
    }

    function renderList(title, items) {
      if (!items || items.length === 0) {
        return "";
      }
      return '<div><h3>' + escapeHtml(title) + '</h3><ul>' + items.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join("") + '</ul></div>';
    }

    function showResult(payload) {
      if (state.showcaseMode) {
        debugDetails.hidden = true;
        result.textContent = "";
        return;
      }
      debugDetails.hidden = false;
      debugDetails.open = false;
      result.hidden = false;
      result.textContent = JSON.stringify(payload, null, 2);
      updateCommandCenter();
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    deskMode.addEventListener("change", function () {
      state.mode = deskMode.value;
      sessionStorage.setItem("agentOfficeDeskMode", state.mode);
      if (state.showcaseMode) {
        setShowcaseMode(true);
        return;
      }
      resetSelection();
    });

    saveKeyButton.addEventListener("click", function () {
      try {
        requireKey();
        setStatus(globalStatus, "API key ready.", "ok");
      } catch (error) {
        setStatus(globalStatus, error.message, "error");
      }
    });

    clearButton.addEventListener("click", function () {
      sessionStorage.removeItem("agentOfficeApiKey");
      apiKeyInput.value = "";
      state.apiKey = "";
      setStatus(globalStatus, "Cleared.");
    });

    showcaseMode.addEventListener("change", function () {
      setShowcaseMode(showcaseMode.checked);
    });

    loadTasksButton.addEventListener("click", async function () {
      const desk = activeDesk();
      if (state.showcaseMode) {
        state.tasks = [showcaseTask];
        renderTasks();
        selectTask(showcaseTask);
        renderImplementationProposal(state.implementationProposal);
        implementationApproveButton.disabled = true;
        setStatus(taskStatus, "Demo queue loaded with sanitized evidence.", "ok");
        setStatus(previewStatus, "Demo work order ready. Write actions are disabled.", "ok");
        return;
      }
      try {
        setStatus(taskStatus, "Loading " + desk.readyLabel + " tasks...");
        const payload = await agentFetch(desk.taskEndpoint);
        state.tasks = payload.tasks || [];
        renderTasks();
        setStatus(taskStatus, String(state.tasks.length) + " ready task" + (state.tasks.length === 1 ? "" : "s") + ".", "ok");
      } catch (error) {
        setStatus(taskStatus, error.message, "error");
      }
    });

    previewButton.addEventListener("click", async function () {
      if (!state.selectedTask) {
        return;
      }

      const desk = activeDesk();
      if (state.showcaseMode) {
        renderImplementationProposal(state.implementationProposal);
        implementationApproveButton.disabled = true;
        setStatus(previewStatus, "Demo work order ready. Write actions are disabled.", "ok");
        return;
      }
      try {
        previewButton.disabled = true;
        approveButton.disabled = true;
        githubPreviewButton.disabled = true;
        githubApproveButton.disabled = true;
        implementationPreviewButton.disabled = true;
        implementationApproveButton.disabled = true;
        closeoutCommitButton.disabled = true;
        setStatus(previewStatus, isReviewDeskMode() ? "Running review..." : isPostMergeCloseoutMode() ? "Generating closeout preview..." : "Generating preview...");
        if (isReviewDeskMode()) {
          const repo = reviewRepo.value.trim();
          const prNumber = Number(reviewPrNumber.value.trim());
          if (!repo || !Number.isInteger(prNumber) || prNumber <= 0) {
            throw new Error("Review repo and PR number are required.");
          }
          const payload = await agentFetch("/agent-office/review-desk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pullRequestNumber: prNumber,
              repository: repo,
              taskId: state.selectedTask.taskId
            })
          });
          state.reviewDeskResult = payload.result;
          renderReviewDeskResult(payload.result);
          approvalPanel.hidden = true;
          revisionPanel.hidden = true;
          approveButton.disabled = true;
          setStatus(previewStatus, "Review packet written to Notion.", "ok");
          showResult(payload.run);
          return;
        }
        if (isPostMergeCloseoutMode()) {
          const repo = reviewRepo.value.trim();
          const prNumber = Number(reviewPrNumber.value.trim());
          if (!repo || !Number.isInteger(prNumber) || prNumber <= 0) {
            throw new Error("Closeout repo and PR number are required.");
          }
          const payload = await agentFetch("/agent-office/post-merge-closeout/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pullRequestNumber: prNumber,
              repository: repo,
              taskId: state.selectedTask.taskId
            })
          });
          state.postMergeCloseoutPreview = payload.preview;
          renderPostMergeCloseoutResult(payload.preview);
          approvalPanel.hidden = true;
          revisionPanel.hidden = true;
          approveButton.disabled = true;
          closeoutCommitButton.disabled = false;
          setStatus(previewStatus, "Closeout preview ready. No Notion writes performed.", "ok");
          showResult(payload.run);
          return;
        }
        const body = isArchitectureMode()
          ? { taskId: state.selectedTask.taskId, dryRun: true }
          : { taskId: state.selectedTask.taskId };
        const payload = await agentFetch(desk.previewEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        state.approval = payload.approval;
        state.artifact = payload[desk.artifactKey];
        state.codexHandoffApprovalToken = isCodexHandoffMode() ? payload.approval.token : null;
        state.githubApproval = null;
        state.githubProposal = null;
        state.implementationApproval = null;
        state.implementationProposal = null;
        state.productContext = payload.productContext || null;
        state.revisionNumber = payload.approval.revisionNumber || 1;
        renderArtifact(state.artifact);
        briefHash.textContent = "v" + state.revisionNumber + " Hash " + payload.approval[desk.hashKey].slice(0, 12);
        expiresAt.textContent = "Expires " + new Date(payload.approval.expiresAt).toLocaleString();
        approvalPanel.hidden = false;
        revisionPanel.hidden = !isArchitectureMode();
        reviseButton.disabled = !isArchitectureMode();
        approveButton.disabled = false;
        setStatus(previewStatus, "Preview ready.", "ok");
        showResult(payload.run);
      } catch (error) {
        setStatus(previewStatus, error.message, "error");
      } finally {
        previewButton.disabled = false;
      }
    });

    reviseButton.addEventListener("click", async function () {
      if (!state.selectedTask || !state.approval || !isArchitectureMode()) {
        return;
      }
      if (state.showcaseMode) {
        setStatus(previewStatus, "Showcase Mode disables live revision writes.", "ok");
        return;
      }

      const feedback = revisionFeedback.value.trim();
      if (!feedback) {
        setStatus(previewStatus, "Revision feedback is required.", "error");
        return;
      }

      try {
        reviseButton.disabled = true;
        approveButton.disabled = true;
        setStatus(previewStatus, "Revising preview...");
        const payload = await agentFetch("/agent-office/architect-review/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previousApprovalToken: state.approval.token,
            revisionFeedback: feedback,
            taskId: state.selectedTask.taskId
          })
        });
        state.approval = payload.approval;
        state.artifact = payload.brief;
        state.productContext = payload.productContext || null;
        state.revisionNumber = payload.approval.revisionNumber || (state.revisionNumber + 1);
        renderArtifact(state.artifact);
        briefHash.textContent = "v" + state.revisionNumber + " Hash " + payload.approval.briefHash.slice(0, 12);
        expiresAt.textContent = "Expires " + new Date(payload.approval.expiresAt).toLocaleString();
        approvalPanel.hidden = false;
        revisionFeedback.value = "";
        approveButton.disabled = false;
        setStatus(previewStatus, "Revised preview ready. The active approval token now points to v" + state.revisionNumber + ".", "ok");
        showResult(payload.run);
      } catch (error) {
        approveButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      } finally {
        reviseButton.disabled = false;
      }
    });

    approveButton.addEventListener("click", async function () {
      if (!state.approval) {
        return;
      }
      if (state.showcaseMode) {
        setStatus(previewStatus, "Showcase Mode disables live writeback.", "ok");
        return;
      }

      const desk = activeDesk();
      try {
        approveButton.disabled = true;
        setStatus(previewStatus, "Writing approved preview...");
        const payload = await agentFetch(desk.approveEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalToken: state.approval.token })
        });
        setStatus(previewStatus, "Writeback complete.", "ok");
        showResult(payload);
        if (isCodexHandoffMode()) {
          githubPreviewButton.disabled = false;
        }
      } catch (error) {
        approveButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      }
    });

    closeoutCommitButton.addEventListener("click", async function () {
      if (!state.selectedTask || !state.postMergeCloseoutPreview) {
        return;
      }
      if (state.showcaseMode) {
        setStatus(previewStatus, "Showcase Mode disables live closeout commits.", "ok");
        return;
      }

      try {
        closeoutCommitButton.disabled = true;
        setStatus(previewStatus, "Committing post-merge closeout to Notion...");
        const payload = await agentFetch("/agent-office/post-merge-closeout/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pullRequestNumber: state.postMergeCloseoutPreview.input.pullRequestNumber,
            repository: state.postMergeCloseoutPreview.input.repository,
            taskId: state.selectedTask.taskId
          })
        });
        state.postMergeCloseoutPreview = payload.result;
        renderPostMergeCloseoutResult(payload.result);
        setStatus(previewStatus, "Post-merge closeout written to Notion.", "ok");
        showResult(payload.run);
      } catch (error) {
        closeoutCommitButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      }
    });

    githubPreviewButton.addEventListener("click", async function () {
      if (!state.codexHandoffApprovalToken) {
        return;
      }

      try {
        githubPreviewButton.disabled = true;
        githubApproveButton.disabled = true;
        setStatus(previewStatus, "Generating GitHub Draft PR proposal...");
        const payload = await agentFetch("/agent-office/github/draft-pr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codexHandoffApprovalToken: state.codexHandoffApprovalToken })
        });
        state.githubApproval = payload.approval;
        state.githubProposal = payload.proposal;
        renderGitHubProposal(payload.proposal);
        briefHash.textContent = "Proposal " + payload.approval.proposalHash.slice(0, 12);
        expiresAt.textContent = "Expires " + new Date(payload.approval.expiresAt).toLocaleString();
        approvalPanel.hidden = false;
        githubApproveButton.disabled = false;
        setStatus(previewStatus, "GitHub Draft PR proposal ready.", "ok");
        showResult(payload.run);
      } catch (error) {
        githubPreviewButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      }
    });

    githubApproveButton.addEventListener("click", async function () {
      if (!state.githubApproval) {
        return;
      }
      if (state.showcaseMode) {
        setStatus(previewStatus, "Showcase Mode disables live GitHub writes.", "ok");
        return;
      }

      try {
        githubApproveButton.disabled = true;
        setStatus(previewStatus, "Creating approved draft PR...");
        const payload = await agentFetch("/agent-office/github/draft-pr/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalToken: state.githubApproval.token })
        });
        setStatus(previewStatus, "Draft PR created and linked back to Notion.", "ok");
        showResult(payload);
      } catch (error) {
        githubApproveButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      }
    });

    implementationPreviewButton.addEventListener("click", async function () {
      if (!state.selectedTask) {
        return;
      }
      if (state.showcaseMode) {
        renderImplementationProposal(state.implementationProposal);
        implementationApproveButton.disabled = true;
        setStatus(previewStatus, "Demo work order ready. Write actions are disabled.", "ok");
        return;
      }

      try {
        implementationPreviewButton.disabled = true;
        implementationApproveButton.disabled = true;
        setStatus(previewStatus, "Generating deterministic implementation work order...");
        const payload = await agentFetch("/agent-office/github/implementation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            state.codexHandoffApprovalToken
              ? { codexHandoffApprovalToken: state.codexHandoffApprovalToken }
              : { taskId: state.selectedTask.taskId }
          )
        });
        state.implementationApproval = payload.approval;
        state.implementationProposal = payload.proposal;
        renderImplementationProposal(payload.proposal);
        briefHash.textContent = "Implementation " + payload.approval.proposalHash.slice(0, 12);
        expiresAt.textContent = "Expires " + new Date(payload.approval.expiresAt).toLocaleString();
        approvalPanel.hidden = false;
        implementationApproveButton.disabled = false;
        setStatus(previewStatus, "Implementation work order ready. Approval will create a starting-point draft PR, not finished implementation.", "ok");
        showResult(payload.run);
      } catch (error) {
        implementationPreviewButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      }
    });

    implementationApproveButton.addEventListener("click", async function () {
      if (!state.implementationApproval) {
        return;
      }
      if (state.showcaseMode) {
        setStatus(previewStatus, "Showcase Mode disables live work-order PR creation.", "ok");
        return;
      }

      try {
        implementationApproveButton.disabled = true;
        setStatus(previewStatus, "Creating approved work-order branch and draft PR...");
        const payload = await agentFetch("/agent-office/github/implementation/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalToken: state.implementationApproval.token })
        });
        setStatus(previewStatus, "Work-order draft PR created and linked back to Notion. Next action: Codex must implement on that branch.", "ok");
        showResult(payload);
      } catch (error) {
        implementationApproveButton.disabled = false;
        setStatus(previewStatus, error.message, "error");
      }
    });
  </script>
</body>
</html>`;
}
