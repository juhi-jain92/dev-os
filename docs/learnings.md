# Learnings — takeaways for future projects

Things worth remembering next time, distilled from building ContractIQ. Not course material — patterns and traps that apply beyond this specific app.

---

## Live system exists at: https://contractiq-legal.netlify.app/

## Working with LLM APIs

- **Reasoning models silently eat your token budget.** Some models (e.g. GLM-4.7-Flash) emit hidden "reasoning" tokens before the real answer unless you explicitly disable it (`thinking: { type: "disabled" }` or equivalent). If a model call returns empty/truncated content with a tight `max_tokens`, check for this before assuming the prompt is wrong.
- **Test a new/unfamiliar provider with a bare curl call before wiring it into app code.** Several real issues (reasoning-mode token drain, exact rate-limit error shape, whether JSON mode is actually respected) were only found by hitting the API directly — much faster to diagnose than through a deployed function.
- **Retry logic must explicitly handle 429, not just 5xx.** A "retry only on server errors" pattern silently fails during rate-limiting, which is one of the most common transient failure modes with any hosted LLM API. Always retry on 429 with backoff.
- **Centralize the retry/API-calling logic in one shared helper**, not one copy per endpoint. Duplicated retry code drifts — one copy in this project had a rate-limit retry bug that the other didn't, purely from being written twice.
- **When an "ambiguous" classification has to default somewhere, default to including more context, not less.** A classifier that silently drops context on the unclear case degrades answers quietly instead of failing loudly — much harder to notice.

## Debugging live systems

- **Verify against the live system, not the code you think is running.** Several bugs (timeouts, missing chat history, wrong classifier default) were only confirmed by testing the actual deployed endpoint/browser, not by reasoning about the code.
- **A rate limit hit while debugging can look identical to the original bug.** If you're hammering an API to diagnose an issue, you can burn through its rate limit and make a since-fixed bug look unresolved. Isolate "is this still broken" from "did my own testing just trigger a limit."
- **A dev server process can be alive but not actually bound to its port.** `ps aux` showing the process running doesn't mean it's serving traffic — check the actual port binding (`lsof -iTCP -sTCP:LISTEN`) when something "isn't working" for no obvious reason.

## Security & secrets

- **Never trust a user-supplied filename in a storage path.** Sanitize it (strip path separators, restrict to a safe charset) before using it to build any path, even if the storage backend has its own access controls — defense in depth against path-traversal-style filenames.
- **Treat any secret pasted into a chat/terminal session as potentially exposed**, even when used correctly — worth rotating later if it matters, regardless of how it was used in the moment.
- **A dev-speed toggle (like disabling email confirmation) needs a tracked "revert before launch" item**, not just a mental note — it's easy to forget once the workaround stops being visible.

## Adapting generic templates/skills to a real architecture

- **Don't blindly create files just to match a generic skill/template structure if they wouldn't actually be used.** If a security or setup skill assumes an architecture the project doesn't have (e.g. API routes when the project uses edge functions), document the deliberate deviation instead of producing unused, dead-code files — that's worse than not having them, because it looks like coverage that isn't real.
- **When a generic doc's checklist doesn't match your approved specs (rate limits, allowed file types, etc.), the approved spec wins** — but say so explicitly rather than silently picking one.

## Provider/architecture migrations

- **Propagate a provider swap across code AND every doc/spec that mentions the old one.** Switching LLM providers mid-project left many scattered mentions of the old provider in specs and engineering docs — worth a deliberate grep-and-fix pass immediately, not "whenever it comes up."

## UI/UX sequencing

- **Build the persistent app shell (nav/header) early, not after individual features.** Every page can work perfectly and the app will still *feel* broken/unfinished without consistent navigation chrome — this was the single biggest perceived-quality gap, unrelated to any actual feature bug.
- **Placeholder-page spacing decisions (padding, margins) made before a real header/nav exists often need revisiting once one is added** — what looked right against an empty page can look excessive once real chrome is in place.

## Working with an AI pair-programmer on a spec-driven project

- **When a request conflicts with an already-approved spec, surface the conflict before implementing** — don't silently override an existing design decision, and don't silently keep the old one either. Ask which wins.
- **"Just check, don't act" is a distinct mode worth using deliberately** — separating investigation from execution avoids compounding a wrong assumption into more code.
