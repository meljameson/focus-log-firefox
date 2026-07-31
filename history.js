let sessions = [];

function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatStart(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${formatClock(timestamp)}`;
}

function formatDuration(milliseconds) {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function sameLocalDay(timestampA, timestampB) {
  const a = new Date(timestampA);
  const b = new Date(timestampB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function render(filter = "") {
  const query = filter.trim().toLowerCase();
  const filtered = sessions.filter((session) => {
    return !query || session.task.toLowerCase().includes(query) || (session.outcome || "").toLowerCase().includes(query);
  });

  const rows = document.getElementById("session-rows");
  rows.replaceChildren();

  for (const session of filtered) {
    const row = document.createElement("tr");

    const startCell = document.createElement("td");
    const startText = document.createElement("div");
    startText.textContent = formatStart(session.startedAt);
    startCell.appendChild(startText);
    if (session.source === "manual") {
      const badge = document.createElement("span");
      badge.className = "manual-badge";
      badge.textContent = "Manual";
      startCell.appendChild(badge);
    }
    row.appendChild(startCell);

    const values = [
      formatClock(session.endedAt),
      session.task,
      session.outcome || "—",
      formatDuration(session.endedAt - session.startedAt)
    ];

    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 2 && value === "—") cell.className = "muted";
      row.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "table-delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteSession(session.id));
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);
    rows.appendChild(row);
  }

  document.getElementById("empty-state").hidden = filtered.length > 0;
  document.getElementById("session-count").textContent = sessions.length;
  document.getElementById("today-count").textContent = sessions.filter((session) => sameLocalDay(session.startedAt, Date.now())).length;
  const totalMilliseconds = sessions.reduce((sum, session) => sum + (session.endedAt - session.startedAt), 0);
  document.getElementById("total-time").textContent = formatDuration(totalMilliseconds || 0).replace("1m", sessions.length ? "1m" : "0m");
}

async function load() {
  const result = await browser.storage.local.get({ sessions: [] });
  sessions = result.sessions;
  sessions.sort((a, b) => b.startedAt - a.startedAt);
  setManualDefaults();
  render();
}

async function deleteSession(id) {
  sessions = sessions.filter((session) => session.id !== id);
  await browser.storage.local.set({ sessions });
  render(document.getElementById("search").value);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const header = ["start", "stop", "task", "outcome", "duration_minutes", "entry_type"];
  const lines = [header.map(csvEscape).join(",")];
  for (const session of [...sessions].reverse()) {
    lines.push([
      new Date(session.startedAt).toISOString(),
      new Date(session.endedAt).toISOString(),
      session.task,
      session.outcome || "",
      Math.round((session.endedAt - session.startedAt) / 60_000),
      session.source === "manual" ? "manual" : "timer"
    ].map(csvEscape).join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `focus-log-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function clearAll() {
  if (!confirm("Delete every saved focus session? This cannot be undone.")) return;
  sessions = [];
  await browser.storage.local.set({ sessions: [] });
  render();
}

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function setManualDefaults() {
  const stop = new Date();
  stop.setSeconds(0, 0);
  const start = new Date(stop.getTime() - 30 * 60_000);
  document.getElementById("manual-date").value = localDateValue(stop);
  document.getElementById("manual-start").value = localTimeValue(start);
  document.getElementById("manual-stop").value = localTimeValue(stop);
}

function timestampFromInputs(dateValue, timeValue) {
  if (!dateValue || !timeValue) return NaN;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

async function addManualSession() {
  const dateValue = document.getElementById("manual-date").value;
  const startValue = document.getElementById("manual-start").value;
  const stopValue = document.getElementById("manual-stop").value;
  const taskInput = document.getElementById("manual-task");
  const outcomeInput = document.getElementById("manual-outcome");
  const message = document.getElementById("manual-message");
  const task = taskInput.value.trim();
  const outcome = outcomeInput.value.trim();

  message.className = "form-message";
  if (!dateValue || !startValue || !stopValue || !task) {
    message.textContent = "Add the date, start, stop, and task.";
    message.classList.add("error-message");
    return;
  }

  const startedAt = timestampFromInputs(dateValue, startValue);
  let endedAt = timestampFromInputs(dateValue, stopValue);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    message.textContent = "Those date or time values could not be read.";
    message.classList.add("error-message");
    return;
  }

  if (endedAt <= startedAt) {
    message.textContent = "Stop time must be later than start time.";
    message.classList.add("error-message");
    return;
  }

  const session = {
    id: crypto.randomUUID(),
    startedAt,
    endedAt,
    task,
    outcome,
    source: "manual"
  };

  sessions.push(session);
  sessions.sort((a, b) => b.startedAt - a.startedAt);
  await browser.storage.local.set({ sessions });
  taskInput.value = "";
  outcomeInput.value = "";
  message.textContent = "Manual log added.";
  message.classList.add("success-message");
  render(document.getElementById("search").value);
  taskInput.focus();
}

document.getElementById("search").addEventListener("input", (event) => render(event.target.value));
document.getElementById("export-button").addEventListener("click", exportCsv);
document.getElementById("clear-button").addEventListener("click", clearAll);
document.getElementById("manual-save").addEventListener("click", addManualSession);
document.getElementById("manual-task").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") addManualSession();
});
document.getElementById("manual-outcome").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") addManualSession();
});
load();
