const ALARM_NAME = "focus-session-ended";
let timerId = null;

const idleView = document.getElementById("idle-view");
const activeView = document.getElementById("active-view");
const pendingView = document.getElementById("pending-view");
const taskInput = document.getElementById("task");
const durationInput = document.getElementById("duration");
const errorOutput = document.getElementById("idle-error");

async function load() {
  const { activeSession = null, pendingSession = null } = await browser.storage.local.get({
    activeSession: null,
    pendingSession: null
  });

  if (pendingSession) {
    showPending(pendingSession);
  } else if (activeSession) {
    showActive(activeSession);
  } else {
    showIdle();
  }
}

function showIdle() {
  clearInterval(timerId);
  idleView.hidden = false;
  activeView.hidden = true;
  pendingView.hidden = true;
  taskInput.focus();
}

function showActive(session) {
  idleView.hidden = true;
  activeView.hidden = false;
  pendingView.hidden = true;
  document.getElementById("active-task").textContent = session.task;
  document.getElementById("started-at").textContent = `Started ${new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  const renderCountdown = () => {
    const remaining = Math.max(0, session.plannedEnd - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    const minutesPart = Math.floor(seconds / 60);
    const secondsPart = String(seconds % 60).padStart(2, "0");
    document.getElementById("countdown").textContent = `${minutesPart}:${secondsPart}`;
  };

  renderCountdown();
  clearInterval(timerId);
  timerId = setInterval(renderCountdown, 1000);
}

function showPending(session) {
  clearInterval(timerId);
  idleView.hidden = true;
  activeView.hidden = true;
  pendingView.hidden = false;
  document.getElementById("pending-task").textContent = session.task;
}

async function startSession() {
  errorOutput.textContent = "";
  const task = taskInput.value.trim();
  const durationMinutes = Number(durationInput.value);

  if (!task) {
    errorOutput.textContent = "Enter a task first.";
    taskInput.focus();
    return;
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
    errorOutput.textContent = "Choose a duration from 1 to 240 minutes.";
    return;
  }

  const startedAt = Date.now();
  const session = {
    id: crypto.randomUUID(),
    task,
    startedAt,
    plannedMinutes: durationMinutes,
    plannedEnd: startedAt + durationMinutes * 60_000
  };

  await browser.storage.local.set({ activeSession: session });
  await browser.alarms.create(ALARM_NAME, { when: session.plannedEnd });
  await browser.action.setBadgeText({ text: "" });
  showActive(session);
}

async function stopSession() {
  const { activeSession } = await browser.storage.local.get({ activeSession: null });
  if (!activeSession) return;

  await browser.alarms.clear(ALARM_NAME);
  const pendingSession = {
    ...activeSession,
    endedAt: Date.now(),
    stopReason: "manual"
  };
  await browser.storage.local.set({ activeSession: null, pendingSession });
  await browser.tabs.create({ url: browser.runtime.getURL("outcome.html") });
  window.close();
}

function openOutcome() {
  browser.tabs.create({ url: browser.runtime.getURL("outcome.html") });
  window.close();
}

function openHistory() {
  browser.tabs.create({ url: browser.runtime.getURL("history.html") });
  window.close();
}

document.getElementById("start-button").addEventListener("click", startSession);
document.getElementById("stop-button").addEventListener("click", stopSession);
document.getElementById("finish-button").addEventListener("click", openOutcome);
document.getElementById("history-button").addEventListener("click", openHistory);
taskInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") startSession();
});

load();
