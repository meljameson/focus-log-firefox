# Focus Log for Firefox

A local-only Firefox extension that records:

- Start time
- Stop time
- Task
- Outcome
- Duration

## Install temporarily for testing

1. Open Firefox.
2. Visit `about:debugging`.
3. Select **This Firefox**.
4. Click **Load Temporary Add-on…**.
5. Choose `manifest.json` from this folder.
6. Pin **Focus Log** to the toolbar if it is hidden in the extensions menu.

Temporary extensions are removed when Firefox restarts. For continued personal use, the extension must be signed or reloaded after restart.

## Use

1. Click the toolbar icon.
2. Enter a task and choose the session length.
3. Click **Start session**.
4. Stop manually, or wait for the timer to finish.
5. Enter an outcome when the completion page opens.
6. Open history from the menu button in the popup.

## Data and permissions

All session data is stored locally with `browser.storage.local`. The extension requests:

- `storage` — save sessions
- `alarms` — end sessions while the popup is closed
- `notifications` — announce timer completion

No website access or network access is requested.

## Files

- `popup.*` — toolbar interface
- `background.js` — timer alarm and completion notification
- `outcome.*` — post-session reflection
- `history.*` — searchable table and CSV export

## Manual logs

The history page includes an **Add a manual log** form for work completed without the timer. Manual entries are labeled in the table and exported with `entry_type` set to `manual`; timer sessions export as `timer`.
