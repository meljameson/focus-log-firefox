let pendingSession = null;

function formatDuration(milliseconds) {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
}

async function load() {
  const result = await browser.storage.local.get({ pendingSession: null });
  pendingSession = result.pendingSession;

  if (!pendingSession) {
    document.getElementById("task-title").textContent = "No session is waiting";
    document.getElementById("session-meta").textContent = "Start a session from the toolbar button.";
    document.getElementById("outcome").disabled = true;
    document.getElementById("save-button").disabled = true;
    document.getElementById("skip-button").disabled = true;
    return;
  }

  document.getElementById("task-title").textContent = pendingSession.task;
  const start = new Date(pendingSession.startedAt);
  const end = new Date(pendingSession.endedAt);
  document.getElementById("session-meta").textContent = `${start.toLocaleDateString()} · ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${formatDuration(pendingSession.endedAt - pendingSession.startedAt)}`;
  document.getElementById("outcome").focus();
}

async function save(outcome) {
  if (!pendingSession) return;
  const { sessions = [] } = await browser.storage.local.get({ sessions: [] });
  const savedSession = {
    id: pendingSession.id,
    startedAt: pendingSession.startedAt,
    endedAt: pendingSession.endedAt,
    task: pendingSession.task,
    outcome,
    plannedMinutes: pendingSession.plannedMinutes,
    stopReason: pendingSession.stopReason
  };

  sessions.push(savedSession);
  sessions.sort((a, b) => b.startedAt - a.startedAt);
  await browser.storage.local.set({ sessions, pendingSession: null });
  await browser.action.setBadgeText({ text: "" });
  window.location.href = "history.html";
}

document.getElementById("save-button").addEventListener("click", () => {
  save(document.getElementById("outcome").value.trim());
});
document.getElementById("skip-button").addEventListener("click", () => save(""));
document.getElementById("outcome").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    save(document.getElementById("outcome").value.trim());
  }
});

load();
