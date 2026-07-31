const ALARM_NAME = "focus-session-ended";

async function getState() {
  const result = await browser.storage.local.get({
    activeSession: null,
    pendingSession: null,
    sessions: []
  });
  return result;
}

async function restoreAlarm() {
  const { activeSession } = await getState();
  if (!activeSession) return;

  const existing = await browser.alarms.get(ALARM_NAME);
  if (!existing) {
    if (activeSession.plannedEnd <= Date.now()) {
      await completeTimedSession(activeSession);
    } else {
      await browser.alarms.create(ALARM_NAME, { when: activeSession.plannedEnd });
    }
  }
}

async function completeTimedSession(session) {
  const endedAt = Date.now();
  const pendingSession = {
    ...session,
    endedAt,
    stopReason: "timer"
  };

  await browser.storage.local.set({ activeSession: null, pendingSession });
  await browser.action.setBadgeText({ text: "✓" });
  await browser.action.setBadgeBackgroundColor({ color: "#356859" });

  await browser.notifications.create("focus-session-complete", {
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-96.svg"),
    title: "Focus session complete",
    message: `What came out of: ${session.task}?`
  });

  await openOutcomePage();
}

async function openOutcomePage() {
  const url = browser.runtime.getURL("outcome.html");
  const existing = await browser.tabs.query({ url });
  if (existing.length > 0) {
    await browser.tabs.update(existing[0].id, { active: true });
    return;
  }
  await browser.tabs.create({ url });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { activeSession } = await getState();
  if (activeSession) await completeTimedSession(activeSession);
});

browser.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId === "focus-session-complete") {
    await openOutcomePage();
    await browser.notifications.clear(notificationId);
  }
});

browser.runtime.onInstalled.addListener(restoreAlarm);
browser.runtime.onStartup.addListener(restoreAlarm);
restoreAlarm();
