type OfficeV2Section = "connections" | "console" | "mission";

export function renderOfficeV2Page(section: OfficeV2Section = "mission"): string {
  const isConnections = section === "connections";
  const isConsole = section === "console";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Office Mission Control</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --shell: #08090b;
      --shell-2: #0d0f13;
      --shell-3: #14171d;
      --canvas: #f6f7f9;
      --canvas-2: #ffffff;
      --canvas-3: #edf1f5;
      --text: #12161d;
      --muted: #667085;
      --muted-2: #98a2b3;
      --line: #dce2ea;
      --line-strong: #c7d0dc;
      --dark-line: rgba(255, 255, 255, 0.1);
      --dark-text: #f5f7fb;
      --dark-muted: #a8b0bd;
      --blue: #2764e7;
      --blue-soft: #eaf1ff;
      --green: #087443;
      --green-soft: #e7f6ee;
      --amber: #9a5b00;
      --amber-soft: #fff5df;
      --red: #b42318;
      --red-soft: #ffebe8;
      --violet: #6941c6;
      --violet-soft: #f1ebff;
      --shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      --shadow-soft: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    html { min-height: 100%; background: var(--shell); }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 18% -12%, rgba(64, 90, 160, 0.22), transparent 34%),
        linear-gradient(180deg, #101218 0%, #08090b 42%, #07080a 100%);
      color: var(--dark-text);
    }
    a { color: inherit; text-decoration: none; }
    button, input, select, textarea { font: inherit; }
    button {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: #fff;
      color: var(--text);
      font-weight: 720;
      cursor: pointer;
      transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease, opacity 150ms ease;
    }
    button:hover { border-color: #9db4e8; color: #164dbb; }
    button:active { transform: translateY(1px); }
    button:disabled { cursor: not-allowed; opacity: 0.5; }
    .primary {
      background: #12161d;
      border-color: #12161d;
      color: #fff;
      box-shadow: 0 1px 0 rgba(255,255,255,0.12) inset, 0 12px 28px rgba(18, 22, 29, 0.18);
    }
    .primary:hover { background: #000; color: #fff; border-color: #000; }
    .quiet { background: #f8fafc; color: #344054; }
    .danger { color: var(--red); border-color: rgba(180, 35, 24, 0.28); background: #fff; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: #fff;
      color: var(--text);
      padding: 10px 12px;
      outline: none;
    }
    textarea { min-height: 84px; resize: vertical; line-height: 1.45; }
    input:focus, select:focus, textarea:focus { border-color: #9db4e8; box-shadow: 0 0 0 3px rgba(39, 100, 231, 0.12); }
    h1, h2, h3, p { margin: 0; }
    h1 { color: var(--text); font-size: clamp(28px, 4vw, 46px); line-height: 1.02; letter-spacing: 0; font-weight: 790; }
    h2 { color: var(--text); font-size: 18px; line-height: 1.2; font-weight: 760; }
    h3 { color: var(--text); font-size: 13px; line-height: 1.3; font-weight: 760; }
    p { line-height: 1.55; }
    .app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
    }
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      border-right: 1px solid var(--dark-line);
      background: rgba(8, 9, 11, 0.74);
      backdrop-filter: blur(18px);
    }
    .brand { padding: 22px 18px 18px; display: grid; gap: 14px; }
    .brand-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      background: linear-gradient(145deg, #ffffff, #aeb9cc 42%, #333b4c);
      color: #050507;
      font-size: 13px;
      font-weight: 850;
    }
    .brand strong { display: block; font-size: 14px; }
    .brand span { display: block; margin-top: 3px; color: var(--dark-muted); font-size: 12px; }
    .nav { padding: 8px 10px; display: grid; gap: 4px; align-content: start; }
    .nav-label { padding: 12px 10px 7px; color: #6f7785; font-size: 11px; text-transform: uppercase; font-weight: 760; }
    .nav a, .nav button {
      min-height: 40px;
      width: 100%;
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      border: 1px solid transparent;
      border-radius: 7px;
      padding: 8px 10px;
      background: transparent;
      color: var(--dark-muted);
      text-align: left;
      font-size: 13px;
      font-weight: 650;
      box-shadow: none;
    }
    .nav a:hover, .nav button:hover { border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #fff; }
    .nav a.active { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.1); }
    .nav-dot { width: 18px; height: 18px; display: grid; place-items: center; color: #7d8796; }
    .nav-count {
      min-width: 22px;
      padding: 2px 7px;
      border-radius: 99px;
      background: rgba(255,255,255,0.08);
      color: #cdd4df;
      font-size: 11px;
      text-align: center;
    }
    .workspace-card {
      margin: 12px;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      background: rgba(255,255,255,0.045);
      display: grid;
      gap: 8px;
      color: var(--dark-muted);
      font-size: 12px;
    }
    .workspace-card strong { color: #fff; font-size: 13px; }
    .main-shell { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 5;
      min-height: 64px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 430px) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 22px;
      border-bottom: 1px solid var(--dark-line);
      background: rgba(9, 10, 13, 0.72);
      backdrop-filter: blur(18px);
    }
    .top-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .top-title strong { font-size: 14px; white-space: nowrap; }
    .repo-pill { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dark-muted); font-size: 12px; }
    .command {
      height: 38px;
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr) auto;
      gap: 9px;
      align-items: center;
      padding: 0 10px;
      border: 1px solid rgba(255,255,255,0.11);
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      color: #858e9e;
      font-size: 13px;
    }
    .kbd { border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; padding: 2px 6px; font-size: 11px; color: #b7bfcc; }
    .top-actions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
    .shell-button {
      min-height: 36px;
      border-color: rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: #e8ecf3;
      padding: 0 12px;
    }
    .shell-button:hover { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.1); color: #fff; }
    .health { display: inline-flex; align-items: center; gap: 7px; color: #cfd5df; font-size: 12px; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #f79009; box-shadow: 0 0 0 4px rgba(247,144,9,0.12); }
    .pulse.ok { background: #12b76a; box-shadow: 0 0 0 4px rgba(18,183,106,0.12); }
    .pulse.err { background: #f04438; box-shadow: 0 0 0 4px rgba(240,68,56,0.12); }
    .page {
      min-width: 0;
      padding: 22px;
      display: grid;
      gap: 18px;
    }
    .mission-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 356px;
      gap: 18px;
      align-items: start;
    }
    .canvas {
      min-width: 0;
      border: 1px solid rgba(255,255,255,0.13);
      border-radius: 8px;
      background: var(--canvas);
      color: var(--text);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .mission-hero {
      padding: 28px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      border-bottom: 1px solid var(--line);
      background:
        linear-gradient(135deg, rgba(255,255,255,0.95), rgba(247,249,252,0.92)),
        linear-gradient(90deg, rgba(39,100,231,0.14), transparent);
    }
    .eyebrow { color: var(--blue); font-size: 11px; text-transform: uppercase; font-weight: 820; letter-spacing: 0; }
    .mission-title { display: grid; gap: 10px; }
    .mission-title p { color: #596273; max-width: 760px; }
    .hero-metrics { display: grid; grid-template-columns: repeat(2, minmax(126px, 1fr)); gap: 10px; align-content: start; }
    .metric {
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,0.72);
      display: grid;
      gap: 6px;
    }
    .metric span { color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 760; }
    .metric strong { color: var(--text); font-size: 14px; overflow-wrap: anywhere; }
    .status-row {
      padding: 14px 28px;
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 28px;
      border: 1px solid var(--line);
      border-radius: 99px;
      padding: 4px 10px;
      background: #fbfcfe;
      color: #475467;
      font-size: 12px;
      font-weight: 680;
      white-space: nowrap;
    }
    .chip.ok { border-color: rgba(8,116,67,0.22); background: var(--green-soft); color: var(--green); }
    .chip.warn { border-color: rgba(154,91,0,0.24); background: var(--amber-soft); color: var(--amber); }
    .chip.info { border-color: rgba(39,100,231,0.22); background: var(--blue-soft); color: #174eb8; }
    .chip.danger { border-color: rgba(180,35,24,0.24); background: var(--red-soft); color: var(--red); }
    .dot { width: 7px; height: 7px; border-radius: 99px; background: currentColor; }
    .canvas-body { padding: 22px 28px 28px; display: grid; gap: 18px; }
    .decision-grid { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(280px, 0.92fr); gap: 16px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      box-shadow: var(--shadow-soft);
      overflow: hidden;
    }
    .card-head {
      padding: 16px 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .card-body { padding: 14px 16px 16px; display: grid; gap: 12px; }
    .card p, .list li { color: var(--muted); font-size: 13px; line-height: 1.5; }
    .list { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .actions button, .actions a { padding: 8px 12px; min-height: 38px; }
    .disabled-reason { color: var(--muted); font-size: 12px; }
    .timeline {
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(8, minmax(96px, 1fr));
      gap: 10px;
      overflow-x: auto;
    }
    .stage {
      position: relative;
      min-height: 92px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfe;
      display: grid;
      align-content: start;
      gap: 8px;
    }
    .stage::after {
      content: "";
      position: absolute;
      top: 22px;
      right: -11px;
      width: 11px;
      height: 1px;
      background: var(--line-strong);
    }
    .stage:last-child::after { display: none; }
    .stage-node {
      width: 18px;
      height: 18px;
      border-radius: 99px;
      border: 2px solid var(--line-strong);
      background: #fff;
    }
    .stage.done { background: #f7fcf9; border-color: rgba(8,116,67,0.18); }
    .stage.done .stage-node { border-color: var(--green); background: var(--green); }
    .stage.active { background: #f3f7ff; border-color: rgba(39,100,231,0.36); box-shadow: inset 0 -3px 0 var(--blue); }
    .stage.active .stage-node { border-color: var(--blue); box-shadow: 0 0 0 5px rgba(39,100,231,0.12); }
    .stage.blocked { background: #fff8ec; border-color: rgba(154,91,0,0.25); }
    .stage span { color: var(--muted); font-size: 11px; font-weight: 760; text-transform: uppercase; }
    .stage strong { color: var(--text); font-size: 13px; line-height: 1.35; }
    .artifact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .artifact {
      min-height: 150px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 14px;
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .artifact-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .artifact-type { color: var(--blue); font-size: 11px; text-transform: uppercase; font-weight: 820; }
    .artifact-title { color: var(--text); font-weight: 760; line-height: 1.3; overflow-wrap: anywhere; }
    .artifact p { color: var(--muted); font-size: 13px; }
    .artifact-foot { display: flex; justify-content: space-between; gap: 10px; align-items: center; color: var(--muted); font-size: 12px; }
    .activity { display: grid; gap: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: #fff; }
    .event {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr) auto;
      gap: 10px;
      padding: 13px 14px;
      border-top: 1px solid var(--line);
      align-items: start;
    }
    .event:first-child { border-top: 0; }
    .event strong { color: var(--text); font-size: 13px; }
    .event span { color: var(--muted); font-size: 12px; }
    .rail {
      position: sticky;
      top: 86px;
      display: grid;
      gap: 14px;
    }
    .rail-card {
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      box-shadow: 0 18px 50px rgba(0,0,0,0.22);
      overflow: hidden;
    }
    .rail-head { padding: 15px 15px 0; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .rail-head h2 { color: #fff; font-size: 15px; }
    .rail-body { padding: 14px 15px 15px; display: grid; gap: 12px; color: var(--dark-muted); font-size: 13px; }
    .confidence {
      height: 8px;
      border-radius: 99px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
    }
    .confidence span { display: block; height: 100%; width: 38%; border-radius: inherit; background: linear-gradient(90deg, #f79009, #12b76a); }
    .rail-list { display: grid; gap: 8px; }
    .rail-item {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr);
      gap: 9px;
      align-items: start;
      color: #c2c9d4;
      line-height: 1.45;
    }
    .rail-item::before { content: ""; width: 7px; height: 7px; border-radius: 99px; margin-top: 7px; background: #667085; }
    .rail-item.ok::before { background: #12b76a; }
    .rail-item.warn::before { background: #f79009; }
    .rail-item.err::before { background: #f04438; }
    .queue-drawer {
      display: grid;
      gap: 10px;
    }
    .queue-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    .task-list { display: grid; gap: 8px; max-height: 290px; overflow: auto; }
    .task-button {
      width: 100%;
      min-height: 68px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 11px;
      border-color: var(--line);
      background: #fbfcfe;
      text-align: left;
      box-shadow: none;
    }
    .task-button.active { border-color: rgba(39,100,231,0.45); background: var(--blue-soft); }
    .task-button strong { display: block; color: var(--text); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-button span { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
    .field-grid { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 8px; }
    .empty {
      min-height: 154px;
      display: grid;
      place-items: center;
      padding: 24px;
      border: 1px dashed var(--line-strong);
      border-radius: 8px;
      background: #fbfcfe;
      color: var(--muted);
      text-align: center;
      font-size: 13px;
    }
    .subpage {
      width: min(980px, 100%);
      margin: 0 auto;
      border: 1px solid rgba(255,255,255,0.13);
      border-radius: 8px;
      background: var(--canvas);
      color: var(--text);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .subpage-hero { padding: 28px; border-bottom: 1px solid var(--line); background: #fff; display: grid; gap: 9px; }
    .subpage-body { padding: 22px 28px 28px; display: grid; gap: 16px; }
    .console-output {
      min-height: 360px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid #202633;
      border-radius: 8px;
      background: #090b10;
      color: #d9e2f0;
      padding: 16px;
      font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .notice {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 13px;
      background: #fbfcfe;
      color: var(--muted);
      font-size: 13px;
    }
    .form-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .form-card label { display: grid; gap: 7px; color: #344054; font-size: 13px; font-weight: 720; }
    @media (max-width: 1240px) {
      .mission-layout { grid-template-columns: 1fr; }
      .rail { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { position: static; height: auto; }
      .topbar { position: static; grid-template-columns: 1fr; }
      .mission-hero, .decision-grid { grid-template-columns: 1fr; }
      .hero-metrics, .artifact-grid, .rail { grid-template-columns: 1fr; }
      .page { padding: 14px; }
      .canvas-body, .mission-hero, .status-row { padding-left: 18px; padding-right: 18px; }
    }
  </style>
</head>
<body data-section="${section}">
  <div class="app">
    <aside class="sidebar" aria-label="Agent Office v2 navigation">
      <div class="brand">
        <div class="brand-mark">AO</div>
        <div>
          <strong>Agent Office</strong>
          <span>AI product mission control</span>
        </div>
      </div>
      <nav class="nav">
        <div class="nav-label">Cockpit</div>
        <a class="${section === "mission" ? "active" : ""}" href="/office-v2"><span class="nav-dot">01</span><span>Mission Control</span><span class="nav-count" data-count="mission">0</span></a>
        <button type="button" data-mode-nav="architecture"><span class="nav-dot">02</span><span>Work Queue</span><span class="nav-count" data-count="queue">0</span></button>
        <a href="#artifacts"><span class="nav-dot">03</span><span>Artifacts</span><span class="nav-count" data-count="artifacts">0</span></a>
        <a href="#decision"><span class="nav-dot">04</span><span>Approvals</span><span class="nav-count" data-count="approvals">0</span></a>
        <a class="${isConnections ? "active" : ""}" href="/office-v2/connections"><span class="nav-dot">05</span><span>Connections</span><span class="nav-count" id="navConnectionState">-</span></a>
        <a href="/office-v2/connections"><span class="nav-dot">06</span><span>Settings</span><span class="nav-count">-</span></a>
        <a class="${isConsole ? "active" : ""}" href="/office-v2/console"><span class="nav-dot">07</span><span>Advanced Console</span><span class="nav-count">raw</span></a>
      </nav>
      <div class="workspace-card">
        <strong id="workspaceName">Local workspace</strong>
        <span id="workspaceContext">Connect to read live queues and approval state.</span>
      </div>
    </aside>
    <section class="main-shell">
      <header class="topbar">
        <div class="top-title">
          <strong>Agent Office</strong>
          <span class="repo-pill" id="topContext">No mission selected</span>
        </div>
        <div class="command" aria-label="Search or command">
          <span>/</span>
          <span>Search or command...</span>
          <span class="kbd">Ctrl K</span>
        </div>
        <div class="top-actions">
          <span class="health"><span class="pulse" id="healthPulse"></span><span id="healthText">Checking</span></span>
          <a class="shell-button" href="/office-v2/connections">Connections</a>
        </div>
      </header>
      ${isConnections ? renderConnectionsMarkup() : isConsole ? renderConsoleMarkup() : renderMissionMarkup()}
    </section>
  </div>
  <script>
    (function () {
      var section = document.body.getAttribute("data-section") || "mission";
      var apiKeyStorageKey = "agentOfficeApiKey";
      var eventStorageKey = "agentOfficeV2Events";
      var state = {
        activeMode: "architecture",
        activity: loadEvents(),
        approval: null,
        approvalKind: null,
        artifact: null,
        closeoutPreview: null,
        githubApproval: null,
        githubProposal: null,
        implementationApproval: null,
        implementationProposal: null,
        productContext: null,
        reviewResult: null,
        run: null,
        selectedTask: null,
        tasksByMode: {}
      };
      var desks = {
        architecture: {
          action: "Generate architecture preview",
          artifactKey: "brief",
          copy: "Scope, constraints, proposed system shape, and approval-gated Notion writeback.",
          name: "Architecture",
          readyLabel: "Ready for Architecture",
          stageIndex: 1,
          taskEndpoint: "/agent-office/tasks/ready-for-architecture",
          previewEndpoint: "/agent-office/architect-review",
          approveEndpoint: "/agent-office/architect-review/approve"
        },
        codexHandoff: {
          action: "Generate Codex handoff",
          artifactKey: "handoff",
          copy: "Implementation packet with guardrails, tests, and boundaries before Codex work.",
          name: "Codex Brief",
          readyLabel: "Ready for Codex",
          stageIndex: 2,
          taskEndpoint: "/agent-office/tasks/ready-for-codex",
          previewEndpoint: "/agent-office/codex-handoff",
          approveEndpoint: "/agent-office/codex-handoff/approve"
        },
        implementationReady: {
          action: "Prepare work-order PR",
          artifactKey: "proposal",
          copy: "Deterministic work-order branch and draft PR proposal. It is not implementation.",
          name: "Implementation",
          readyLabel: "In Codex",
          stageIndex: 3,
          taskEndpoint: "/agent-office/tasks/implementation-ready",
          previewEndpoint: "/agent-office/github/implementation",
          approveEndpoint: "/agent-office/github/implementation/approve"
        },
        reviewDesk: {
          action: "Run review desk",
          artifactKey: "result",
          copy: "Review a real GitHub PR against the Notion work order and policy gates.",
          name: "Review",
          readyLabel: "Implementation evidence",
          stageIndex: 4,
          taskEndpoint: "/agent-office/tasks/implementation-ready",
          previewEndpoint: "/agent-office/review-desk"
        },
        postMergeCloseout: {
          action: "Preview closeout",
          artifactKey: "preview",
          copy: "Verify merged PR and deployment evidence before writing closeout back to Notion.",
          name: "Merge / Closeout",
          readyLabel: "Merged PR",
          stageIndex: 7,
          taskEndpoint: "/agent-office/tasks/implementation-ready",
          previewEndpoint: "/agent-office/post-merge-closeout/preview",
          approveEndpoint: "/agent-office/post-merge-closeout/commit"
        }
      };
      var stageNames = ["Intake", "Architecture", "Codex Brief", "Implementation", "Review", "PR / Preview", "Approval", "Merge / Closeout"];

      var els = {};
      [
        "activeStage", "activityList", "approvalCount", "approvalReason", "approvalRequired", "approvalTitle",
        "artifactGrid", "confidenceBar", "confidenceText", "connectionList", "decisionApproveButton",
        "decisionEvidenceButton", "decisionPrepareButton", "decisionRequestButton", "decisionStatus",
        "disabledReason", "evidenceList", "feedbackInput", "healthPulse", "healthText", "integrationSummary",
        "lastUpdated", "loadQueueButton", "missionCopy", "missionTitle", "modeSelect", "navConnectionState",
        "previewButton", "queueCount", "repoInput", "reviewPrInput", "riskLevel", "safeActionButton",
        "safeActionCopy", "safeActionImpact", "safeActionRollback", "safeActionTitle", "selectedRoute",
        "stageTimeline", "taskList", "topContext", "workspaceContext", "workspaceName"
      ].forEach(function (id) {
        els[id] = document.getElementById(id);
      });

      if (section === "connections") {
        initConnectionsPage();
        checkHealth();
        return;
      }

      if (section === "console") {
        initConsolePage();
        checkHealth();
        return;
      }

      bindMissionEvents();
      checkHealth();
      renderMission();
      if (getApiKey()) {
        loadAllQueueCounts();
      }

      function bindMissionEvents() {
        if (els.modeSelect) {
          els.modeSelect.addEventListener("change", function () {
            setMode(els.modeSelect.value);
          });
        }
        document.querySelectorAll("[data-mode-nav]").forEach(function (button) {
          button.addEventListener("click", function () {
            setMode(button.getAttribute("data-mode-nav") || "architecture");
            if (els.taskList) {
              els.taskList.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          });
        });
        if (els.loadQueueButton) {
          els.loadQueueButton.addEventListener("click", function () { loadQueue(state.activeMode); });
        }
        if (els.previewButton) {
          els.previewButton.addEventListener("click", runPreview);
        }
        if (els.safeActionButton) {
          els.safeActionButton.addEventListener("click", runPreview);
        }
        if (els.decisionApproveButton) {
          els.decisionApproveButton.addEventListener("click", approveActiveDecision);
        }
        if (els.decisionRequestButton) {
          els.decisionRequestButton.addEventListener("click", requestArchitectureRevision);
        }
        if (els.decisionEvidenceButton) {
          els.decisionEvidenceButton.addEventListener("click", function () {
            var target = document.getElementById("evidencePanel");
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
        if (els.decisionPrepareButton) {
          els.decisionPrepareButton.addEventListener("click", prepareFollowOnWork);
        }
      }

      function initConnectionsPage() {
        var keyInput = document.getElementById("connectionApiKey");
        var saveButton = document.getElementById("saveConnectionButton");
        var clearButton = document.getElementById("clearConnectionButton");
        var testButton = document.getElementById("testConnectionButton");
        var status = document.getElementById("connectionStatus");
        if (keyInput) {
          keyInput.value = getApiKey();
        }
        setConnectionStatus(status, getApiKey() ? "API key is stored in this browser session." : "No browser-stored API key yet.");
        if (saveButton && keyInput) {
          saveButton.addEventListener("click", function () {
            var value = keyInput.value.trim();
            if (!value) {
              setConnectionStatus(status, "Enter an Agent Office API key before saving.", "warn");
              return;
            }
            sessionStorage.setItem(apiKeyStorageKey, value);
            addEvent("Connection settings updated", "Agent Office API key saved in browser session.");
            setConnectionStatus(status, "Saved. Mission Control can now load protected queues.", "ok");
          });
        }
        if (clearButton && keyInput) {
          clearButton.addEventListener("click", function () {
            sessionStorage.removeItem(apiKeyStorageKey);
            keyInput.value = "";
            addEvent("Connection settings cleared", "Protected actions require a key before they can run.");
            setConnectionStatus(status, "Cleared. No protected actions will run.", "warn");
          });
        }
        if (testButton) {
          testButton.addEventListener("click", async function () {
            try {
              setConnectionStatus(status, "Testing protected queue access...");
              var payload = await agentFetch("/agent-office/tasks/ready-for-architecture");
              setConnectionStatus(status, "Connection works. Found " + ((payload.tasks || []).length) + " architecture-ready task(s).", "ok");
            } catch (error) {
              setConnectionStatus(status, error.message, "warn");
            }
          });
        }
      }

      function initConsolePage() {
        var output = document.getElementById("consoleOutput");
        var clear = document.getElementById("clearConsoleButton");
        var refresh = document.getElementById("refreshConsoleButton");
        var render = function () {
          var events = loadEvents();
          if (!output) return;
          output.textContent = events.length
            ? JSON.stringify(events, null, 2)
            : "No browser-side Agent Office v2 events yet. Run a queue load, preview, approval, review, or closeout action to populate this console.";
        };
        if (clear) {
          clear.addEventListener("click", function () {
            sessionStorage.removeItem(eventStorageKey);
            render();
          });
        }
        if (refresh) {
          refresh.addEventListener("click", render);
        }
        render();
      }

      function setMode(mode) {
        state.activeMode = desks[mode] ? mode : "architecture";
        state.selectedTask = null;
        state.approval = null;
        state.approvalKind = null;
        state.artifact = null;
        state.githubApproval = null;
        state.githubProposal = null;
        state.implementationApproval = null;
        state.implementationProposal = null;
        state.reviewResult = null;
        state.closeoutPreview = null;
        state.run = null;
        if (els.modeSelect) els.modeSelect.value = state.activeMode;
        renderMission();
      }

      async function checkHealth() {
        try {
          var response = await fetch("/health");
          var payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || "Health check failed.");
          setHealth("ok", "Healthy");
        } catch (error) {
          setHealth("err", "Unavailable");
        }
        if (els.navConnectionState) els.navConnectionState.textContent = getApiKey() ? "set" : "open";
      }

      function setHealth(kind, label) {
        if (els.healthPulse) {
          els.healthPulse.className = "pulse " + (kind || "");
        }
        if (els.healthText) {
          els.healthText.textContent = label;
        }
      }

      async function loadAllQueueCounts() {
        var modes = ["architecture", "codexHandoff", "implementationReady"];
        for (var index = 0; index < modes.length; index += 1) {
          try {
            await loadQueue(modes[index], true);
          } catch (_error) {
            // Individual queue cards render their own blocked state.
          }
        }
        renderMission();
      }

      async function loadQueue(mode, silent) {
        var desk = desks[mode];
        if (!desk) return;
        if (!getApiKey()) {
          addEvent("Connection required", "Protected queues need an Agent Office API key from Connections.");
          renderMission();
          return;
        }
        if (!silent) addEvent("Loading queue", desk.readyLabel + " queue requested.");
        var payload = await agentFetch(desk.taskEndpoint);
        state.tasksByMode[mode] = payload.tasks || [];
        if (!silent && state.activeMode === mode) {
          addEvent("Queue loaded", String(state.tasksByMode[mode].length) + " real task(s) found for " + desk.name + ".");
        }
        renderMission();
      }

      async function runPreview() {
        var desk = desks[state.activeMode];
        if (!desk || !state.selectedTask) {
          renderMission();
          return;
        }
        if (!getApiKey()) {
          addEvent("Connection required", "Preview actions require a configured Agent Office API key.");
          renderMission();
          return;
        }
        try {
          setBusy(true, "Preparing safe preview...");
          var payload;
          if (state.activeMode === "reviewDesk" || state.activeMode === "postMergeCloseout") {
            var reviewInput = getReviewInput();
            payload = await agentFetch(desk.previewEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pullRequestNumber: reviewInput.pullRequestNumber,
                repository: reviewInput.repository,
                taskId: state.selectedTask.taskId
              })
            });
          } else if (state.activeMode === "implementationReady") {
            payload = await agentFetch(desk.previewEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId: state.selectedTask.taskId })
            });
          } else {
            var body = state.activeMode === "architecture"
              ? { taskId: state.selectedTask.taskId, dryRun: true }
              : { taskId: state.selectedTask.taskId };
            payload = await agentFetch(desk.previewEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });
          }
          applyPreviewPayload(payload);
          addEvent("Preview ready", desk.name + " evidence is ready for human review.");
        } catch (error) {
          addEvent("Preview blocked", error.message);
        } finally {
          setBusy(false);
          renderMission();
        }
      }

      function applyPreviewPayload(payload) {
        var desk = desks[state.activeMode];
        state.run = payload.run || null;
        if (state.activeMode === "reviewDesk") {
          state.reviewResult = payload.result || null;
          state.artifact = payload.result || null;
          state.approval = null;
          state.approvalKind = null;
          return;
        }
        if (state.activeMode === "postMergeCloseout") {
          state.closeoutPreview = payload.preview || null;
          state.artifact = payload.preview || null;
          state.approval = state.closeoutPreview;
          state.approvalKind = "closeout";
          return;
        }
        if (state.activeMode === "implementationReady") {
          state.implementationApproval = payload.approval || null;
          state.implementationProposal = payload.proposal || null;
          state.approval = state.implementationApproval;
          state.approvalKind = "implementation";
          state.artifact = state.implementationProposal;
          return;
        }
        state.approval = payload.approval || null;
        state.approvalKind = state.activeMode;
        state.artifact = payload[desk.artifactKey] || null;
        state.productContext = payload.productContext || null;
      }

      async function approveActiveDecision() {
        if (!state.approval || !state.approvalKind) return;
        if (!getApiKey()) {
          addEvent("Approval blocked", "A configured API key is required before approval writes can run.");
          renderMission();
          return;
        }
        try {
          setBusy(true, "Submitting approval...");
          var payload;
          if (state.approvalKind === "closeout") {
            var closeoutInput = state.closeoutPreview && state.closeoutPreview.input;
            payload = await agentFetch("/agent-office/post-merge-closeout/commit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(closeoutInput)
            });
          } else if (state.approvalKind === "implementation") {
            payload = await agentFetch("/agent-office/github/implementation/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approvalToken: state.implementationApproval.token })
            });
          } else if (state.approvalKind === "githubDraft") {
            payload = await agentFetch("/agent-office/github/draft-pr/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approvalToken: state.githubApproval.token })
            });
          } else {
            var desk = desks[state.activeMode];
            payload = await agentFetch(desk.approveEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approvalToken: state.approval.token })
            });
          }
          state.run = payload.run || state.run;
          addEvent("Human approval recorded", approvalOutcomeLabel(payload));
          if (state.approvalKind === "codexHandoff") {
            state.codexHandoffApprovalToken = state.approval.token;
          }
        } catch (error) {
          addEvent("Approval failed", error.message);
        } finally {
          setBusy(false);
          renderMission();
        }
      }

      async function requestArchitectureRevision() {
        if (state.activeMode !== "architecture" || !state.approval || !state.selectedTask) return;
        var feedback = els.feedbackInput ? els.feedbackInput.value.trim() : "";
        if (!feedback) {
          addEvent("Revision needs feedback", "Add a specific change request before asking the Architecture Desk to revise.");
          renderMission();
          return;
        }
        try {
          setBusy(true, "Requesting revised architecture preview...");
          var payload = await agentFetch("/agent-office/architect-review/revise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              previousApprovalToken: state.approval.token,
              revisionFeedback: feedback,
              taskId: state.selectedTask.taskId
            })
          });
          state.approval = payload.approval;
          state.approvalKind = "architecture";
          state.artifact = payload.brief;
          state.productContext = payload.productContext || null;
          state.run = payload.run || null;
          if (els.feedbackInput) els.feedbackInput.value = "";
          addEvent("Architecture revision ready", "A new approval token now points to the revised preview.");
        } catch (error) {
          addEvent("Revision failed", error.message);
        } finally {
          setBusy(false);
          renderMission();
        }
      }

      async function prepareFollowOnWork() {
        if (state.activeMode === "codexHandoff" && state.approval) {
          try {
            setBusy(true, "Preparing GitHub draft PR proposal...");
            var payload = await agentFetch("/agent-office/github/draft-pr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ codexHandoffApprovalToken: state.approval.token })
            });
            state.githubApproval = payload.approval;
            state.githubProposal = payload.proposal;
            state.approval = state.githubApproval;
            state.approvalKind = "githubDraft";
            state.artifact = state.githubProposal;
            state.run = payload.run || null;
            addEvent("GitHub draft PR proposal ready", "Human approval is required before GitHub writes.");
          } catch (error) {
            addEvent("Draft PR prep blocked", error.message);
          } finally {
            setBusy(false);
            renderMission();
          }
          return;
        }
        setMode("codexHandoff");
        loadQueue("codexHandoff");
      }

      function getReviewInput() {
        var repository = els.repoInput ? els.repoInput.value.trim() : "";
        var pullRequestNumber = els.reviewPrInput ? Number(els.reviewPrInput.value.trim()) : 0;
        if (!repository || !Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
          throw new Error("Repository and PR number are required for this desk.");
        }
        return { repository: repository, pullRequestNumber: pullRequestNumber };
      }

      function renderMission() {
        var desk = desks[state.activeMode];
        var tasks = state.tasksByMode[state.activeMode] || [];
        var hasKey = Boolean(getApiKey());
        var hasSelectedTask = Boolean(state.selectedTask);
        var hasApproval = Boolean(state.approval);
        var activeStageIndex = stageIndex();
        if (els.modeSelect) els.modeSelect.value = state.activeMode;
        if (els.workspaceContext) els.workspaceContext.textContent = hasKey ? "Protected workflows available from this browser." : "Open Connections to enable protected workflows.";
        if (els.workspaceName) els.workspaceName.textContent = state.selectedTask ? "Mission workspace" : "Local workspace";
        if (els.topContext) els.topContext.textContent = missionContextText();
        if (els.missionTitle) els.missionTitle.textContent = state.selectedTask ? state.selectedTask.name : "No active mission selected";
        if (els.missionCopy) els.missionCopy.textContent = state.selectedTask
          ? desk.copy
          : "Load a real Agent Office queue and choose a task to begin supervision. The cockpit will not invent operational state.";
        if (els.activeStage) els.activeStage.textContent = stageNames[activeStageIndex] || desk.name;
        if (els.decisionStatus) els.decisionStatus.textContent = hasApproval ? "Decision required" : hasSelectedTask ? "Preview required" : "Waiting for mission";
        if (els.selectedRoute) els.selectedRoute.textContent = desk.name;
        if (els.lastUpdated) els.lastUpdated.textContent = state.run && state.run.finishedAt ? formatDate(state.run.finishedAt) : "No run yet";
        if (els.queueCount) els.queueCount.textContent = String(tasks.length);
        if (els.approvalCount) els.approvalCount.textContent = hasApproval ? "1" : "0";
        renderStatusChips(hasKey, hasSelectedTask, hasApproval);
        renderTimeline(activeStageIndex);
        renderQueue(tasks, desk);
        renderDecision(desk, hasKey, hasSelectedTask, hasApproval);
        renderSafeAction(desk, hasKey, hasSelectedTask);
        renderArtifacts();
        renderEvidence();
        renderConnections(hasKey);
        renderActivity();
        updateNavCounts(tasks.length);
      }

      function renderStatusChips(hasKey, hasSelectedTask, hasApproval) {
        setText("chipConnection", hasKey ? "Connection ready" : "Connection required");
        setChip("chipConnection", hasKey ? "ok" : "warn");
        setText("chipMission", hasSelectedTask ? "Mission active" : "No mission selected");
        setChip("chipMission", hasSelectedTask ? "info" : "warn");
        setText("chipHuman", hasApproval ? "Human decision required" : "No pending approval");
        setChip("chipHuman", hasApproval ? "warn" : "info");
        setText("chipWrite", "No automatic merge or deploy");
      }

      function renderTimeline(activeIndex) {
        if (!els.stageTimeline) return;
        els.stageTimeline.innerHTML = stageNames.map(function (name, index) {
          var className = index < activeIndex ? "stage done" : index === activeIndex ? "stage active" : "stage";
          if (state.approval && index === 6) className = "stage blocked";
          return '<div class="' + className + '"><div class="stage-node"></div><span>0' + (index + 1) + '</span><strong>' + escapeHtml(name) + '</strong></div>';
        }).join("");
      }

      function renderQueue(tasks, desk) {
        if (!els.taskList) return;
        if (!getApiKey()) {
          els.taskList.innerHTML = '<div class="empty">Connect an Agent Office API key on the Connections page to load protected queues.</div>';
          return;
        }
        if (!tasks.length) {
          els.taskList.innerHTML = '<div class="empty">No ' + escapeHtml(desk.readyLabel) + ' tasks loaded. Load the queue to check real Notion state.</div>';
          return;
        }
        els.taskList.innerHTML = tasks.map(function (task, index) {
          var active = state.selectedTask && state.selectedTask.taskId === task.taskId ? " active" : "";
          return '<button class="task-button' + active + '" type="button" data-task-index="' + index + '"><span><strong>' + escapeHtml(task.name || "Untitled task") + '</strong><span>' + escapeHtml(task.status || desk.readyLabel) + '</span></span><span class="chip ' + priorityClass(task.priority) + '">' + escapeHtml(task.priority || "Normal") + '</span></button>';
        }).join("");
        els.taskList.querySelectorAll("[data-task-index]").forEach(function (button) {
          button.addEventListener("click", function () {
            var index = Number(button.getAttribute("data-task-index"));
            state.selectedTask = tasks[index] || null;
            state.approval = null;
            state.approvalKind = null;
            state.artifact = null;
            addEvent("Mission selected", state.selectedTask ? state.selectedTask.name : "No task selected.");
            renderMission();
          });
        });
      }

      function renderDecision(desk, hasKey, hasSelectedTask, hasApproval) {
        if (els.approvalTitle) els.approvalTitle.textContent = hasApproval ? decisionTitle() : "No approval is pending";
        if (els.approvalReason) els.approvalReason.textContent = hasApproval
          ? "Agent Office has prepared a bounded action. Review the artifact and evidence before allowing any writeback."
          : hasSelectedTask
            ? "Generate a preview first. The preview creates the approval boundary without committing live changes."
            : "Select a real task from a protected queue before a human decision can exist.";
        if (els.approvalRequired) els.approvalRequired.textContent = hasApproval ? "Approval required" : "Not ready";
        if (els.riskLevel) els.riskLevel.textContent = riskText();
        var approveDisabled = !hasKey || !hasApproval;
        var requestDisabled = state.activeMode !== "architecture" || !hasApproval;
        if (els.decisionApproveButton) els.decisionApproveButton.disabled = approveDisabled;
        if (els.decisionRequestButton) els.decisionRequestButton.disabled = requestDisabled;
        if (els.decisionEvidenceButton) els.decisionEvidenceButton.disabled = !state.artifact && !state.run && !state.productContext;
        if (els.decisionPrepareButton) els.decisionPrepareButton.disabled = !hasKey || (!hasSelectedTask && state.activeMode !== "codexHandoff");
        if (els.disabledReason) {
          els.disabledReason.textContent = approveDisabled
            ? disabledReason(hasKey, hasSelectedTask, hasApproval)
            : "Approval will use the existing tokenized backend path for this desk.";
        }
      }

      function renderSafeAction(desk, hasKey, hasSelectedTask) {
        var canPreview = hasKey && hasSelectedTask && desk.previewEndpoint;
        if (els.safeActionTitle) els.safeActionTitle.textContent = canPreview ? desk.action : "Load and select a real mission";
        if (els.safeActionCopy) els.safeActionCopy.textContent = canPreview
          ? "This is the safest next move because it produces reviewable evidence before any approval write."
          : "The cockpit needs a configured connection and a selected Notion task before it can call protected workflows.";
        if (els.safeActionImpact) els.safeActionImpact.textContent = state.activeMode === "architecture"
          ? "Backend impact: dry-run model preview only until approval."
          : state.activeMode === "implementationReady"
            ? "Backend impact: proposal first; approval creates a starting-point draft PR."
            : "Backend impact: existing endpoint boundary is preserved.";
        if (els.safeActionRollback) els.safeActionRollback.textContent = "Rollback path: do not approve the preview; no automatic merge, deploy, or product repo mutation occurs from preview.";
        if (els.safeActionButton) els.safeActionButton.disabled = !canPreview;
        if (els.previewButton) els.previewButton.disabled = !canPreview;
      }

      function renderArtifacts() {
        if (!els.artifactGrid) return;
        var artifacts = [];
        if (state.selectedTask) {
          artifacts.push({
            type: "Notion task",
            status: state.selectedTask.status || desks[state.activeMode].readyLabel,
            title: state.selectedTask.name || "Selected task",
            summary: "Source task selected from the protected Agent Office queue.",
            updated: "Live queue",
            action: "Selected"
          });
        }
        if (state.artifact && state.activeMode !== "implementationReady") {
          artifacts.push(describeArtifact(state.activeMode, state.artifact));
        }
        if (state.githubProposal) {
          artifacts.push(describeGitHubProposal(state.githubProposal));
        }
        if (state.implementationProposal) {
          artifacts.push(describeImplementationProposal(state.implementationProposal));
        }
        if (state.run) {
          artifacts.push({
            type: "Run summary",
            status: state.run.outcome || "recorded",
            title: state.run.workflow || "Agent Office run",
            summary: "Auditable run summary returned by the existing backend.",
            updated: state.run.finishedAt ? formatDate(state.run.finishedAt) : "Just now",
            action: "Console"
          });
        }
        if (!artifacts.length) {
          els.artifactGrid.innerHTML = '<div class="empty">Artifacts appear here only after a real task is selected or a preview returns data.</div>';
          return;
        }
        els.artifactGrid.innerHTML = artifacts.map(renderArtifactCard).join("");
      }

      function renderArtifactCard(artifact) {
        var href = artifact.href ? '<a class="chip info" href="' + escapeHtml(artifact.href) + '" target="_blank" rel="noreferrer">Open</a>' : '<span class="chip">' + escapeHtml(artifact.action || "Ready") + '</span>';
        return '<article class="artifact"><div class="artifact-top"><div><div class="artifact-type">' + escapeHtml(artifact.type) + '</div><div class="artifact-title">' + escapeHtml(artifact.title) + '</div></div><span class="chip ' + statusClass(artifact.status) + '">' + escapeHtml(artifact.status || "ready") + '</span></div><p>' + escapeHtml(artifact.summary) + '</p><div class="artifact-foot"><span>' + escapeHtml(artifact.updated || "Updated now") + '</span>' + href + '</div></article>';
      }

      function renderEvidence() {
        if (els.confidenceText) els.confidenceText.textContent = confidenceText();
        if (els.confidenceBar) els.confidenceBar.style.width = confidenceWidth();
        if (els.evidenceList) {
          var evidence = evidenceItems();
          els.evidenceList.innerHTML = evidence.map(function (item) {
            return '<div class="rail-item ' + item.kind + '">' + escapeHtml(item.text) + '</div>';
          }).join("");
        }
      }

      function renderConnections(hasKey) {
        if (!els.connectionList) return;
        var items = [
          { kind: "ok", text: "Agent Office service health is checked through /health." },
          { kind: hasKey ? "ok" : "warn", text: hasKey ? "Browser session has an Agent Office API key." : "Protected workflow API key is not configured in this browser." },
          { kind: "warn", text: "Notion, GitHub, Vercel, OpenAI, Claude, and Codex health is inferred from real endpoint availability; no fake integration state is displayed." }
        ];
        els.connectionList.innerHTML = items.map(function (item) {
          return '<div class="rail-item ' + item.kind + '">' + escapeHtml(item.text) + '</div>';
        }).join("");
        if (els.integrationSummary) els.integrationSummary.textContent = hasKey ? "Protected endpoints ready to test." : "Connection required for protected endpoints.";
      }

      function renderActivity() {
        if (!els.activityList) return;
        var events = state.activity.slice(0, 8);
        if (!events.length) {
          els.activityList.innerHTML = '<div class="empty">Human-readable activity will appear after queue, preview, approval, review, or closeout actions.</div>';
          return;
        }
        els.activityList.innerHTML = events.map(function (event) {
          return '<div class="event"><span class="dot"></span><div><strong>' + escapeHtml(event.title) + '</strong><br><span>' + escapeHtml(event.body) + '</span></div><span>' + escapeHtml(formatDate(event.at)) + '</span></div>';
        }).join("");
      }

      function updateNavCounts(queueCount) {
        var total = Object.keys(state.tasksByMode).reduce(function (sum, key) { return sum + (state.tasksByMode[key] || []).length; }, 0);
        setTextBySelector('[data-count="mission"]', state.selectedTask ? "1" : "0");
        setTextBySelector('[data-count="queue"]', String(total || queueCount || 0));
        setTextBySelector('[data-count="artifacts"]', String((state.selectedTask ? 1 : 0) + (state.artifact ? 1 : 0) + (state.run ? 1 : 0)));
        setTextBySelector('[data-count="approvals"]', state.approval ? "1" : "0");
      }

      function stageIndex() {
        if (state.approval) return 6;
        if (state.run && state.activeMode === "postMergeCloseout") return 7;
        if (state.run && state.activeMode === "reviewDesk") return 4;
        if (state.run && state.activeMode === "implementationReady") return 5;
        return desks[state.activeMode].stageIndex;
      }

      function describeArtifact(mode, artifact) {
        if (mode === "architecture") {
          return {
            type: "Architecture brief",
            status: "preview",
            title: artifact.briefTitle || "Architecture preview",
            summary: artifact.executiveSummary || "Architecture preview returned by the existing workflow.",
            updated: state.run && state.run.finishedAt ? formatDate(state.run.finishedAt) : "Just now",
            action: "Review"
          };
        }
        if (mode === "codexHandoff") {
          return {
            type: "Codex handoff",
            status: "preview",
            title: artifact.suggestedPrTitle || artifact.problemSummary || "Codex handoff",
            summary: artifact.productIntent || artifact.problemSummary || "Implementation handoff returned by the existing workflow.",
            updated: state.run && state.run.finishedAt ? formatDate(state.run.finishedAt) : "Just now",
            action: "Review"
          };
        }
        if (mode === "reviewDesk") {
          return {
            type: "Review notes",
            status: artifact.review ? artifact.review.verdict : "reviewed",
            title: artifact.evidence && artifact.evidence.pullRequest ? artifact.evidence.pullRequest.title : "Review Desk packet",
            summary: artifact.review ? artifact.review.summary : "Review packet returned by the Review Desk.",
            updated: artifact.evidence ? formatDate(artifact.evidence.collectedAt) : "Just now",
            href: artifact.evidence && artifact.evidence.pullRequest ? artifact.evidence.pullRequest.url : undefined
          };
        }
        if (mode === "postMergeCloseout") {
          return {
            type: "Closeout summary",
            status: artifact.committed ? "committed" : "preview",
            title: artifact.notionTask ? artifact.notionTask.title : "Post-merge closeout",
            summary: artifact.plan && artifact.plan.taskPrLinkCheck ? artifact.plan.taskPrLinkCheck.message : "Closeout preview returned by the existing workflow.",
            updated: artifact.generatedAt ? formatDate(artifact.generatedAt) : "Just now",
            href: artifact.notionTask ? artifact.notionTask.url : undefined
          };
        }
        return describeImplementationProposal(artifact);
      }

      function describeGitHubProposal(proposal) {
        return {
          type: "GitHub PR",
          status: "draft proposal",
          title: proposal.prTitle || "Draft PR proposal",
          summary: "Repository " + proposal.repository + " on branch " + proposal.branchName + ". Approval is required before GitHub writes.",
          updated: "Just now",
          action: "Approve"
        };
      }

      function describeImplementationProposal(proposal) {
        return {
          type: "Codex handoff",
          status: "work-order",
          title: proposal.prTitle || "Implementation work order",
          summary: proposal.nextAction || "Starting-point work order for Codex implementation.",
          updated: "Just now",
          action: "Review"
        };
      }

      function evidenceItems() {
        var items = [];
        if (state.selectedTask) items.push({ kind: "ok", text: "Selected Notion task: " + (state.selectedTask.name || state.selectedTask.taskId) + "." });
        if (state.productContext) items.push({ kind: "ok", text: "Product context pack returned with the preview." });
        if (state.run) items.push({ kind: state.run.outcome === "failed" ? "err" : "ok", text: "Backend run recorded outcome: " + (state.run.outcome || "unknown") + "." });
        if (state.approval) items.push({ kind: "warn", text: "Approval token exists in memory for this browser session; approval still requires a deliberate click." });
        if (state.implementationProposal) items.push({ kind: "warn", text: "Implementation work-order preview does not implement product code, merge, or deploy." });
        if (!items.length) {
          items.push({ kind: "warn", text: "No live evidence loaded yet. The cockpit is waiting for a real queue or preview." });
        }
        items.push({ kind: "ok", text: "Guardrail: existing approval logic and protected endpoints remain the execution boundary." });
        items.push({ kind: "ok", text: "Will not touch: API keys on main page, automatic merge, automatic deploy, product repo settings, or secrets." });
        return items;
      }

      function confidenceText() {
        if (state.run && state.artifact && state.approval) return "High confidence: preview, artifact, run summary, and approval boundary are present.";
        if (state.selectedTask && state.artifact) return "Medium confidence: mission and artifact are loaded; approval may still be pending.";
        if (state.selectedTask) return "Low-medium confidence: mission selected, preview evidence not generated yet.";
        return "Low confidence: no mission evidence loaded.";
      }

      function confidenceWidth() {
        if (state.run && state.artifact && state.approval) return "86%";
        if (state.selectedTask && state.artifact) return "64%";
        if (state.selectedTask) return "42%";
        return "24%";
      }

      function missionContextText() {
        if (state.implementationProposal) return state.implementationProposal.repository + " / " + state.implementationProposal.branchName;
        if (state.githubProposal) return state.githubProposal.repository + " / " + state.githubProposal.branchName;
        if (state.selectedTask) return state.selectedTask.status || desks[state.activeMode].readyLabel;
        return "No mission selected";
      }

      function decisionTitle() {
        if (state.approvalKind === "githubDraft") return "Approve GitHub draft PR creation";
        if (state.approvalKind === "implementation") return "Approve work-order draft PR";
        if (state.approvalKind === "closeout") return "Commit post-merge closeout";
        if (state.activeMode === "architecture") return "Approve architecture brief writeback";
        if (state.activeMode === "codexHandoff") return "Approve Codex handoff writeback";
        return "Approve controlled Agent Office action";
      }

      function riskText() {
        if (state.approvalKind === "implementation" || state.approvalKind === "githubDraft") return "Medium: GitHub write after approval";
        if (state.approvalKind === "closeout") return "Medium: Notion closeout write after approval";
        if (state.approval) return "Low-medium: Notion write after approval";
        return "Low: preview or selection only";
      }

      function disabledReason(hasKey, hasSelectedTask, hasApproval) {
        if (!hasKey) return "Disabled because protected Agent Office API access is not configured.";
        if (!hasSelectedTask) return "Disabled until a real queue task is selected.";
        if (!hasApproval) return "Disabled until a preview creates an approval token or closeout preview.";
        return "Disabled.";
      }

      function approvalOutcomeLabel(payload) {
        if (payload.github && payload.github.pullRequestUrl) return "GitHub draft PR created: " + payload.github.pullRequestUrl;
        if (payload.result && payload.result.committed) return "Closeout written to Notion.";
        if (payload.statusUpdated) return "Notion writeback complete.";
        return "Approval returned successfully.";
      }

      function priorityClass(value) {
        var text = String(value || "").toLowerCase();
        if (text.includes("high") || text.includes("urgent")) return "danger";
        if (text.includes("medium")) return "warn";
        return "info";
      }

      function statusClass(value) {
        var text = String(value || "").toLowerCase();
        if (text.includes("ready") || text.includes("approved") || text.includes("committed") || text.includes("succeeded")) return "ok";
        if (text.includes("blocked") || text.includes("failed")) return "danger";
        if (text.includes("approval") || text.includes("preview") || text.includes("draft")) return "warn";
        return "info";
      }

      function setBusy(isBusy, label) {
        [els.previewButton, els.safeActionButton, els.decisionApproveButton, els.decisionRequestButton, els.decisionPrepareButton].forEach(function (button) {
          if (button) button.dataset.busy = isBusy ? "true" : "false";
        });
        if (isBusy && els.safeActionTitle && label) els.safeActionTitle.textContent = label;
      }

      async function agentFetch(url, options) {
        var key = getApiKey();
        if (!key) throw new Error("Agent Office API key is not configured.");
        var headers = new Headers(options && options.headers ? options.headers : undefined);
        headers.set("x-agent-office-api-key", key);
        var response = await fetch(url, Object.assign({}, options || {}, { headers: headers }));
        var payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || "Agent Office request failed.");
        }
        return payload;
      }

      function getApiKey() {
        return sessionStorage.getItem(apiKeyStorageKey) || "";
      }

      function addEvent(title, body) {
        var event = { at: new Date().toISOString(), body: body, title: title };
        state.activity = [event].concat(loadEvents()).slice(0, 30);
        sessionStorage.setItem(eventStorageKey, JSON.stringify(state.activity));
      }

      function loadEvents() {
        try {
          var raw = sessionStorage.getItem(eventStorageKey);
          var parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
          return [];
        }
      }

      function setConnectionStatus(node, message, kind) {
        if (!node) return;
        node.textContent = message;
        node.className = "notice " + (kind || "");
      }

      function setText(id, value) {
        var node = document.getElementById(id);
        if (node) node.textContent = value;
      }

      function setTextBySelector(selector, value) {
        document.querySelectorAll(selector).forEach(function (node) {
          node.textContent = value;
        });
      }

      function setChip(id, kind) {
        var node = document.getElementById(id);
        if (node) node.className = "chip " + kind;
      }

      function formatDate(value) {
        try {
          return new Date(value).toLocaleString();
        } catch (_error) {
          return String(value || "Unknown");
        }
      }

      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }
    })();
  </script>
</body>
</html>`;
}

function renderMissionMarkup(): string {
  return `<main class="page">
        <div class="mission-layout">
          <section class="canvas">
            <header class="mission-hero">
              <div class="mission-title">
                <div class="eyebrow">Mission Control</div>
                <h1 id="missionTitle">No active mission selected</h1>
                <p id="missionCopy">Load a real Agent Office queue and choose a task to begin supervision. The cockpit will not invent operational state.</p>
              </div>
              <div class="hero-metrics">
                <div class="metric"><span>Current stage</span><strong id="activeStage">Intake</strong></div>
                <div class="metric"><span>Human loop</span><strong id="decisionStatus">Waiting for mission</strong></div>
                <div class="metric"><span>Route</span><strong id="selectedRoute">Architecture</strong></div>
                <div class="metric"><span>Last updated</span><strong id="lastUpdated">No run yet</strong></div>
              </div>
            </header>
            <div class="status-row">
              <span class="chip warn" id="chipConnection"><span class="dot"></span>Connection required</span>
              <span class="chip warn" id="chipMission"><span class="dot"></span>No mission selected</span>
              <span class="chip info" id="chipHuman"><span class="dot"></span>No pending approval</span>
              <span class="chip info" id="chipWrite"><span class="dot"></span>No automatic merge or deploy</span>
            </div>
            <div class="canvas-body">
              <section class="decision-grid" id="decision">
                <article class="card">
                  <div class="card-head">
                    <div>
                      <div class="eyebrow">Human Decision</div>
                      <h2 id="approvalTitle">No approval is pending</h2>
                    </div>
                    <span class="chip warn" id="approvalRequired">Not ready</span>
                  </div>
                  <div class="card-body">
                    <p id="approvalReason">Select a real task from a protected queue before a human decision can exist.</p>
                    <div class="notice"><strong>Risk:</strong> <span id="riskLevel">Low: preview or selection only</span></div>
                    <label>
                      <span class="eyebrow">Request changes</span>
                      <textarea id="feedbackInput" placeholder="Add architecture revision feedback when a preview needs changes."></textarea>
                    </label>
                    <div class="actions">
                      <button class="primary" id="decisionApproveButton" type="button" disabled>Approve</button>
                      <button id="decisionRequestButton" type="button" disabled>Request changes</button>
                      <button class="quiet" id="decisionEvidenceButton" type="button" disabled>View evidence</button>
                      <button class="quiet" id="decisionPrepareButton" type="button" disabled>Prepare Codex brief</button>
                    </div>
                    <div class="disabled-reason" id="disabledReason">Disabled until a real queue task is selected.</div>
                  </div>
                </article>
                <article class="card">
                  <div class="card-head">
                    <div>
                      <div class="eyebrow">Safe Next Action</div>
                      <h2 id="safeActionTitle">Load and select a real mission</h2>
                    </div>
                    <span class="chip info">Preview first</span>
                  </div>
                  <div class="card-body">
                    <p id="safeActionCopy">The cockpit needs a configured connection and a selected Notion task before it can call protected workflows.</p>
                    <ul class="list">
                      <li id="safeActionImpact">Backend impact: existing endpoint boundary is preserved.</li>
                      <li>Route impact: the existing /office page and all backend workflow routes remain unchanged.</li>
                      <li id="safeActionRollback">Rollback path: do not approve the preview.</li>
                      <li>Approval required before any writeback, GitHub write, closeout commit, merge, or deploy.</li>
                    </ul>
                    <div class="actions">
                      <button class="primary" id="safeActionButton" type="button" disabled>Run safe preview</button>
                      <button id="previewButton" type="button" disabled>Generate preview</button>
                    </div>
                  </div>
                </article>
              </section>
              <section class="card">
                <div class="card-head">
                  <div>
                    <div class="eyebrow">Workflow Timeline</div>
                    <h2>Mission stage</h2>
                  </div>
                </div>
                <div class="timeline" id="stageTimeline"></div>
              </section>
              <section class="card">
                <div class="card-head">
                  <div>
                    <div class="eyebrow">Work Queue</div>
                    <h2>Live mission source</h2>
                  </div>
                  <span class="chip info"><span id="queueCount">0</span> tasks</span>
                </div>
                <div class="card-body queue-drawer">
                  <div class="queue-toolbar">
                    <select id="modeSelect" aria-label="Workflow lane">
                      <option value="architecture">Architecture</option>
                      <option value="codexHandoff">Codex Brief</option>
                      <option value="implementationReady">Implementation</option>
                      <option value="reviewDesk">Review</option>
                      <option value="postMergeCloseout">Merge / Closeout</option>
                    </select>
                    <button id="loadQueueButton" type="button">Load queue</button>
                  </div>
                  <div class="field-grid">
                    <input id="repoInput" placeholder="owner/repo for review or closeout">
                    <input id="reviewPrInput" placeholder="PR #" inputmode="numeric">
                  </div>
                  <div class="task-list" id="taskList"></div>
                </div>
              </section>
              <section class="card" id="artifacts">
                <div class="card-head">
                  <div>
                    <div class="eyebrow">Artifacts</div>
                    <h2>Evidence-backed work products</h2>
                  </div>
                </div>
                <div class="card-body">
                  <div class="artifact-grid" id="artifactGrid"></div>
                </div>
              </section>
              <section class="card">
                <div class="card-head">
                  <div>
                    <div class="eyebrow">Activity</div>
                    <h2>Human-readable stream</h2>
                  </div>
                </div>
                <div class="card-body">
                  <div class="activity" id="activityList"></div>
                </div>
              </section>
            </div>
          </section>
          <aside class="rail" aria-label="Mission intelligence">
            <section class="rail-card" id="evidencePanel">
              <div class="rail-head">
                <h2>Evidence / Confidence</h2>
                <span class="chip warn" id="approvalCount">0</span>
              </div>
              <div class="rail-body">
                <p id="confidenceText">Low confidence: no mission evidence loaded.</p>
                <div class="confidence"><span id="confidenceBar"></span></div>
                <div class="rail-list" id="evidenceList"></div>
              </div>
            </section>
            <section class="rail-card">
              <div class="rail-head">
                <h2>Connected Systems</h2>
                <span class="chip info">Live only</span>
              </div>
              <div class="rail-body">
                <p id="integrationSummary">Connection required for protected endpoints.</p>
                <div class="rail-list" id="connectionList"></div>
              </div>
            </section>
            <section class="rail-card">
              <div class="rail-head">
                <h2>Next Best Actions</h2>
              </div>
              <div class="rail-body">
                <div class="rail-item ok">Load a protected queue from Notion.</div>
                <div class="rail-item ok">Generate a preview before approval.</div>
                <div class="rail-item warn">Use Advanced Console only for raw payload inspection.</div>
              </div>
            </section>
          </aside>
        </div>
      </main>`;
}

function renderConnectionsMarkup(): string {
  return `<main class="page">
        <section class="subpage">
          <header class="subpage-hero">
            <div class="eyebrow">Connections</div>
            <h1>Connection Center</h1>
            <p>Manage browser-side Agent Office access for protected workflow routes. API keys stay off the main mission page.</p>
          </header>
          <div class="subpage-body">
            <div class="form-card">
              <label>Agent Office API key
                <input id="connectionApiKey" type="password" autocomplete="off" placeholder="Stored in this browser session only">
              </label>
              <div class="actions">
                <button class="primary" id="saveConnectionButton" type="button">Save key</button>
                <button id="testConnectionButton" type="button">Test queue access</button>
                <button class="danger" id="clearConnectionButton" type="button">Clear</button>
                <a class="chip info" href="/office-v2">Back to Mission Control</a>
              </div>
              <div class="notice" id="connectionStatus">No browser-stored API key yet.</div>
            </div>
            <div class="card">
              <div class="card-head"><div><div class="eyebrow">Integration Boundaries</div><h2>What this page manages</h2></div></div>
              <div class="card-body">
                <ul class="list">
                  <li>Notion, GitHub, Vercel, OpenAI, Claude, and Codex behavior remains owned by existing backend configuration.</li>
                  <li>This page only stores or clears the browser key used to call protected Agent Office routes.</li>
                  <li>No secret values are shown in the top bar or main mission canvas.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>`;
}

function renderConsoleMarkup(): string {
  return `<main class="page">
        <section class="subpage">
          <header class="subpage-hero">
            <div class="eyebrow">Advanced Console</div>
            <h1>Raw Event Console</h1>
            <p>Debug output is secondary by design. Mission Control shows human-readable activity; this page holds browser-side raw v2 events.</p>
          </header>
          <div class="subpage-body">
            <div class="actions">
              <button class="primary" id="refreshConsoleButton" type="button">Refresh</button>
              <button class="danger" id="clearConsoleButton" type="button">Clear local events</button>
              <a class="chip info" href="/office-v2">Back to Mission Control</a>
              <a class="chip" href="/office">Open classic console</a>
            </div>
            <pre class="console-output" id="consoleOutput">Loading local Agent Office v2 events...</pre>
          </div>
        </section>
      </main>`;
}
