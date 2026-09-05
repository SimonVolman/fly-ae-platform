# Project memory

## Production maintenance reminder

- After any action that can enable, preserve, or change the PROD release mode
  (including deploys, rollbacks, workflow runs, and infrastructure updates),
  verify the live `https://fly.ae` homepage before finishing the task.
- If the live site is still in maintenance mode, tell the user prominently in
  the final response. Put the warning near the beginning and state clearly that
  the normal web application is unavailable.
- Give the relevant next action for returning to application mode when useful.
- Do not assume that a successful backend or Telegram deployment means the
  application frontend is live; verify the rendered homepage separately.
- This reminder applies even when maintenance mode was intentionally enabled.
