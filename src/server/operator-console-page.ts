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
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #607084;
      --border: #d7dde6;
      --accent: #0f766e;
      --accent-strong: #0b5d56;
      --danger: #b42318;
      --ok: #117044;
      --shadow: 0 16px 40px rgba(23, 32, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    main { width: min(1180px, calc(100vw - 32px)); margin: 32px auto 56px; display: grid; gap: 18px; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; font-weight: 720; }
    h2 { margin: 0 0 12px; font-size: 18px; line-height: 1.2; }
    h3 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0; color: var(--muted); }
    p { margin: 0; color: var(--muted); line-height: 1.5; }
    .grid { display: grid; grid-template-columns: minmax(280px, 390px) minmax(0, 1fr); gap: 18px; align-items: start; }
    section, .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); padding: 18px; }
    label { display: block; font-size: 13px; font-weight: 650; margin-bottom: 8px; }
    input, select, textarea { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 11px 12px; font: inherit; color: var(--text); background: #fff; }
    textarea { min-height: 94px; resize: vertical; line-height: 1.45; }
    input:focus, select:focus, textarea:focus { outline: 2px solid rgba(15, 118, 110, 0.18); border-color: var(--accent); }
    button { border: 1px solid var(--border); background: #fff; color: var(--text); border-radius: 6px; min-height: 38px; padding: 8px 12px; font: inherit; font-weight: 650; cursor: pointer; }
    button:hover { border-color: var(--accent); color: var(--accent-strong); }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    button.primary:hover { background: var(--accent-strong); color: #fff; }
    button.danger { border-color: rgba(180, 35, 24, 0.35); color: var(--danger); }
    button:disabled { opacity: 0.48; cursor: not-allowed; }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .stack { display: grid; gap: 12px; }
    .tasks { display: grid; gap: 8px; margin-top: 12px; }
    .task { width: 100%; text-align: left; display: grid; gap: 5px; padding: 11px 12px; }
    .task strong { font-size: 14px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
    .pill { border: 1px solid var(--border); border-radius: 999px; padding: 3px 8px; background: #fbfcfd; }
    .status { min-height: 22px; font-size: 13px; color: var(--muted); }
    .status.error { color: var(--danger); }
    .status.ok { color: var(--ok); }
    .brief { display: grid; gap: 10px; }
    .brief-title { font-size: 20px; font-weight: 720; color: var(--text); }
    .brief p, .brief li { color: var(--text); line-height: 1.5; }
    .brief ul { margin: 6px 0 0; padding-left: 20px; }
    .empty { min-height: 260px; display: grid; place-items: center; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); text-align: center; padding: 18px; }
    .proposal-pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid var(--border); background: #fbfcfd; border-radius: 6px; padding: 12px; max-height: 260px; overflow: auto; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .context-summary { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; background: #fbfcfd; display: grid; gap: 6px; }
    .context-summary strong { font-size: 13px; }
    .context-summary .gaps { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .result { white-space: pre-wrap; overflow-wrap: anywhere; background: #0f172a; color: #e5edf7; border-radius: 8px; padding: 14px; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; max-height: 320px; overflow: auto; }
    @media (max-width: 860px) {
      main { width: min(100vw - 20px, 760px); margin-top: 20px; }
      header { align-items: flex-start; flex-direction: column; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Agent Office</h1>
        <p>Operator Console v0</p>
      </div>
      <div class="status" id="globalStatus"></div>
    </header>

    <div class="grid">
      <section class="stack">
        <div>
          <label for="deskMode">Desk</label>
          <select id="deskMode">
            <option value="architecture">Architecture Desk</option>
            <option value="codexHandoff">Codex Handoff Desk</option>
            <option value="implementationReady">Implementation Ready</option>
            <option value="reviewDesk">Review + Iteration Desk</option>
          </select>
        </div>
        <div>
          <label for="apiKey">API key</label>
          <input id="apiKey" type="password" autocomplete="off" placeholder="x-agent-office-api-key">
        </div>
        <div class="row">
          <button class="primary" id="saveKeyButton">Use key</button>
          <button id="loadTasksButton">Load tasks</button>
          <button class="danger" id="clearButton">Clear</button>
        </div>
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
      </section>

      <section class="stack">
        <div class="row" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 id="selectedTaskTitle">Architect Brief Preview</h2>
            <p id="selectedTaskMeta">No task selected</p>
          </div>
          <div class="row">
            <button id="previewButton" disabled>Preview</button>
            <button class="primary" id="approveButton" disabled>Approve writeback</button>
            <button id="githubPreviewButton" hidden disabled>Preview draft PR</button>
            <button class="primary" id="githubApproveButton" hidden disabled>Create draft PR</button>
            <button id="implementationPreviewButton" hidden disabled>Preview work order</button>
            <button class="primary" id="implementationApproveButton" hidden disabled>Create work-order PR</button>
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
        <div class="result" id="result" hidden></div>
      </section>
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
      productContext: null,
      reviewDeskResult: null,
      revisionNumber: 0,
      selectedTask: null,
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
    const clearButton = document.getElementById("clearButton");
    const deskMode = document.getElementById("deskMode");
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
    const taskList = document.getElementById("taskList");
    const taskStatus = document.getElementById("taskStatus");

    apiKeyInput.value = state.apiKey;
    deskMode.value = desks[state.mode] ? state.mode : "architecture";
    state.mode = deskMode.value;
    resetSelection();

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

    function syncControlsForMode() {
      previewButton.hidden = isImplementationReadyMode();
      approveButton.hidden = isImplementationReadyMode() || isReviewDeskMode();
      githubPreviewButton.hidden = !isCodexHandoffMode();
      githubApproveButton.hidden = !isCodexHandoffMode();
      implementationPreviewButton.hidden = !isImplementationReadyMode();
      implementationApproveButton.hidden = !isImplementationReadyMode();
      reviewDeskInputs.hidden = !isReviewDeskMode();
      previewButton.textContent = activeDesk().previewButtonLabel;
    }

    function setStatus(element, message, type) {
      element.textContent = message;
      element.className = ("status " + (type || "")).trim();
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
      revisionFeedback.value = "";
      revisionPanel.hidden = true;
      reviseButton.disabled = true;
      taskList.innerHTML = "";
      briefPreview.innerHTML = '<div class="empty">Select a ' + escapeHtml(desk.readyLabel) + ' task.</div>';
      setStatus(previewStatus, "");
      setStatus(taskStatus, "");
    }

    function renderTasks() {
      taskList.innerHTML = "";
      if (state.tasks.length === 0) {
        taskList.innerHTML = '<div class="empty">No ready tasks.</div>';
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
    }

    function selectTask(task) {
      state.selectedTask = task;
      state.approval = null;
      state.artifact = null;
      state.codexHandoffApprovalToken = null;
      state.githubApproval = null;
      state.githubProposal = null;
      state.implementationApproval = null;
      state.implementationProposal = null;
      state.productContext = null;
      state.reviewDeskResult = null;
      state.revisionNumber = 0;
      selectedTaskTitle.textContent = task.name;
      selectedTaskMeta.textContent = task.status + " / " + task.taskId;
      syncControlsForMode();
      previewButton.disabled = isImplementationReadyMode();
      approveButton.disabled = true;
      githubPreviewButton.disabled = true;
      githubApproveButton.disabled = true;
      implementationPreviewButton.disabled = !isImplementationReadyMode();
      implementationApproveButton.disabled = true;
      approvalPanel.hidden = true;
      revisionFeedback.value = "";
      revisionPanel.hidden = true;
      reviseButton.disabled = true;
      result.hidden = true;
      briefPreview.innerHTML = '<div class="empty">Preview not generated.</div>';
      setStatus(previewStatus, "");
    }

    function renderArtifact(artifact) {
      if (isReviewDeskMode()) {
        renderReviewDeskResult(artifact);
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
        '<p><strong>Repository:</strong> ' + escapeHtml(proposal.repository) + '</p>',
        '<p><strong>Base:</strong> ' + escapeHtml(proposal.baseBranch) + ' @ ' + escapeHtml(proposal.baseCommitSha) + '</p>',
        '<p><strong>Branch:</strong> ' + escapeHtml(proposal.branchName) + '</p>',
        '<p><strong>File:</strong> ' + escapeHtml(proposal.handoffFilePath) + '</p>',
        '<p><strong>Commit:</strong> ' + escapeHtml(proposal.commitMessage) + '</p>',
        '<h3>Draft PR Body</h3><pre class="proposal-pre">' + escapeHtml(proposal.prBody) + '</pre>',
        '<h3>Handoff File Content</h3><pre class="proposal-pre">' + escapeHtml(proposal.handoffFileContent) + '</pre>',
        '<h3>Approval Boundary</h3><p>Draft only. This will not merge, deploy, push to main, or change repo settings/secrets.</p>'
      ].join("");
    }

    function renderImplementationProposal(proposal) {
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
        '<h3>PR Body</h3><pre class="proposal-pre">' + escapeHtml(proposal.prBody) + '</pre>',
        '<h3>Work Order Content</h3><pre class="proposal-pre">' + escapeHtml(proposal.workOrderContent) + '</pre>',
        '<h3>Approval Boundary</h3><p>Draft only. Agent Office will commit only this work-order file. Product implementation must happen later on the created branch; this will not merge, deploy, push to main, or change repo settings/secrets.</p>'
      ].join("");
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
      result.hidden = false;
      result.textContent = JSON.stringify(payload, null, 2);
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

    loadTasksButton.addEventListener("click", async function () {
      const desk = activeDesk();
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
      try {
        previewButton.disabled = true;
        approveButton.disabled = true;
        githubPreviewButton.disabled = true;
        githubApproveButton.disabled = true;
        implementationPreviewButton.disabled = true;
        implementationApproveButton.disabled = true;
        setStatus(previewStatus, isReviewDeskMode() ? "Running review..." : "Generating preview...");
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
