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
    input, select { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 11px 12px; font: inherit; color: var(--text); background: #fff; }
    input:focus, select:focus { outline: 2px solid rgba(15, 118, 110, 0.18); border-color: var(--accent); }
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
            <option value="implementation">Implementation Desk</option>
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
          </div>
        </div>
        <div class="status" id="previewStatus"></div>
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
        previewEndpoint: "/agent-office/architect-review",
        previewTitle: "Architect Brief Preview",
        readyLabel: "Ready for Architecture",
        taskEndpoint: "/agent-office/tasks/ready-for-architecture",
        workflowName: "Architecture Desk"
      },
      implementation: {
        approveEndpoint: "/agent-office/codex-handoff/approve",
        artifactKey: "handoff",
        hashKey: "handoffHash",
        previewEndpoint: "/agent-office/codex-handoff",
        previewTitle: "Codex Handoff Preview",
        readyLabel: "Ready for Codex",
        taskEndpoint: "/agent-office/tasks/ready-for-codex",
        workflowName: "Implementation Desk"
      }
    };

    const state = {
      apiKey: sessionStorage.getItem("agentOfficeApiKey") || "",
      approval: null,
      artifact: null,
      codexHandoffApprovalToken: null,
      githubApproval: null,
      githubProposal: null,
      mode: sessionStorage.getItem("agentOfficeDeskMode") || "architecture",
      selectedTask: null,
      tasks: []
    };

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
    const globalStatus = document.getElementById("globalStatus");
    const loadTasksButton = document.getElementById("loadTasksButton");
    const previewButton = document.getElementById("previewButton");
    const previewStatus = document.getElementById("previewStatus");
    const result = document.getElementById("result");
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
      state.selectedTask = null;
      state.tasks = [];
      selectedTaskTitle.textContent = desk.previewTitle;
      selectedTaskMeta.textContent = "No task selected";
      previewButton.disabled = true;
      approveButton.disabled = true;
      approvalPanel.hidden = true;
      result.hidden = true;
      githubPreviewButton.hidden = state.mode !== "implementation";
      githubApproveButton.hidden = state.mode !== "implementation";
      githubPreviewButton.disabled = true;
      githubApproveButton.disabled = true;
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
      selectedTaskTitle.textContent = task.name;
      selectedTaskMeta.textContent = task.status + " / " + task.taskId;
      previewButton.disabled = false;
      approveButton.disabled = true;
      githubPreviewButton.disabled = true;
      githubApproveButton.disabled = true;
      approvalPanel.hidden = true;
      result.hidden = true;
      briefPreview.innerHTML = '<div class="empty">Preview not generated.</div>';
      setStatus(previewStatus, "");
    }

    function renderArtifact(artifact) {
      if (state.mode === "implementation") {
        renderCodexHandoff(artifact);
        return;
      }

      renderArchitectBrief(artifact);
    }

    function renderArchitectBrief(brief) {
      const sections = [
        ["Recommended Architecture", brief.recommendedArchitecture],
        ["File Structure", brief.fileStructure],
        ["Dependencies", brief.dependencies],
        ["Configuration", brief.configuration],
        ["Implementation Plan", brief.implementationPlan],
        ["Risks", brief.risks],
        ["Open Questions", brief.openQuestions]
      ];

      briefPreview.innerHTML = '<div class="brief-title">' + escapeHtml(brief.briefTitle) + '</div><p>' + escapeHtml(brief.executiveSummary) + '</p>' + sections.map(function (section) {
        return renderList(section[0], section[1]);
      }).join("");
    }

    function renderCodexHandoff(handoff) {
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
        '<div class="brief-title">' + escapeHtml(handoff.suggestedPrTitle) + '</div>',
        '<p><strong>Target repo:</strong> ' + escapeHtml(handoff.targetProductRepo) + '</p>',
        '<p><strong>Suggested branch:</strong> ' + escapeHtml(handoff.suggestedBranchName) + '</p>',
        '<h3>Problem Summary</h3><p>' + escapeHtml(handoff.problemSummary) + '</p>',
        '<h3>Product Intent</h3><p>' + escapeHtml(handoff.productIntent) + '</p>',
        sections.map(function (section) { return renderList(section[0], section[1]); }).join(""),
        '<h3>Suggested PR Body</h3><p>' + escapeHtml(handoff.suggestedPrBody) + '</p>'
      ].join("");
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
        setStatus(previewStatus, "Generating preview...");
        const body = state.mode === "architecture"
          ? { taskId: state.selectedTask.taskId, dryRun: true }
          : { taskId: state.selectedTask.taskId };
        const payload = await agentFetch(desk.previewEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        state.approval = payload.approval;
        state.artifact = payload[desk.artifactKey];
        state.codexHandoffApprovalToken = state.mode === "implementation" ? payload.approval.token : null;
        state.githubApproval = null;
        state.githubProposal = null;
        renderArtifact(state.artifact);
        briefHash.textContent = "Hash " + payload.approval[desk.hashKey].slice(0, 12);
        expiresAt.textContent = "Expires " + new Date(payload.approval.expiresAt).toLocaleString();
        approvalPanel.hidden = false;
        approveButton.disabled = false;
        setStatus(previewStatus, "Preview ready.", "ok");
        showResult(payload.run);
      } catch (error) {
        setStatus(previewStatus, error.message, "error");
      } finally {
        previewButton.disabled = false;
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
        if (state.mode === "implementation") {
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
  </script>
</body>
</html>`;
}
