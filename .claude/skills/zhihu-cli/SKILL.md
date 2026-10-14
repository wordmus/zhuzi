---
name: zhihu-cli
description: Use the locally installed zhihu CLI to log in with a QR code, safely search and browse Zhihu content, inspect questions, answers, users, topics, feeds, and account data, and perform explicitly authorized Zhihu actions. Use when a user asks to search Zhihu, view hot lists or content, manage Zhihu login, or explicitly vote, follow, publish, or delete Zhihu content.
---

# Zhihu CLI

Use the locally installed `zhihu` command for Zhihu tasks. Treat it as a
third-party, cookie-based client: it does not confer official Zhihu API status,
extra permissions, or a fixed request quota.

## Start safely

1. Confirm the executable is available with `zhihu --version`. If the command
   is unavailable, say so and ask whether to install or repair it; do not
   replace it with browser automation or scraping without the user's approval.
2. Use `zhihu --help` or `zhihu <command> --help` when a flag may differ by
   installed version.
3. Use `zhihu status` before a request that needs authentication. It checks the
   locally saved login state without making a network request.

## Authentication and credentials

Prefer QR-code login:

```bash
zhihu login --qrcode
```

Keep the command running while the user scans and confirms in the Zhihu app.
The QR image is written locally to `~/.zhihu-cli/login_qrcode.png`; display or
send that image to the user when the environment supports it.

Never print, paste into chat, save in a workspace, or forward the contents of
`~/.zhihu-cli/cookies.json` or any Cookie header. Do not ask the user to paste
cookies when QR login is viable. Run `zhihu logout` only when the user asks to
remove the saved session.

## Read content

Use `--json` for data queries, then extract only the fields needed for the
answer. Start with small limits and suppress nested content unless the user
asks for it:

```bash
zhihu hot --limit 10 --answers 0 --json
zhihu search "<query>" --limit 5 --answers 0 --json
zhihu question <question-id> --answers --limit 5 --json
zhihu answer <answer-id> --comments --limit 10 --json
```

Use a profile URL token, not a display name, with `user`, `user-answers`,
`user-articles`, `followers`, and `following`. Use `feed`, `feeds`, `topic`,
`collections`, `notifications`, and `whoami` only when the requested scope
actually requires them. Retrieve a large body or all comments only after the
user asks for that depth.

Search responses can contain non-content cards such as advertisements or
e-books. When reporting search results, prioritize actual question, answer,
article, or people results, and provide titles, authors when available, and
direct Zhihu URLs.

## Request limits and failures

No fixed remaining quota is exposed by this CLI. Treat the effective limit as
dynamic and controlled by Zhihu. Keep requests sequential and modest, avoid
bulk pagination by default, and do not make retry loops.

If a request returns `401`, `403`, `429`, a CAPTCHA, or another access error,
stop the sequence and report the error. Do not alter browser fingerprints,
rotate cookies or IP addresses, or attempt to bypass anti-abuse controls.

## Actions that change the account or content

Treat `vote`, `follow-question`, `ask`, `pin`, `article`, and every
`delete-*` command as state-changing. Run one only when the current user
message clearly specifies the intended action and exact target or final content.
For publishing, obtain the exact title, body, topics, and image paths before
submitting. For deletion, restate the target and require an explicit current
turn confirmation.

Do not add `-y` to a destructive command unless the user explicitly asks to
skip its confirmation prompt. Do not infer approval from a request to browse,
search, summarize, or draft content. After a successful action, report what
changed and return any created content ID or URL if available.

## Report results

Summarize useful results rather than dumping raw JSON. Clearly distinguish
Zhihu users' claims from verified facts, preserve relevant URLs, and mention
when a result is incomplete because of the requested limit, login state, or an
API error.
