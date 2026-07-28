# Spec: Contract Chat (Q&A)

**Source:** `docs/engineering/engineering-doc.md` §4 (Flow 4), §7 (Grounding Strategy), §8, §9; PRD §7–9

## Overview

The `chat` Edge Function answers user questions about a specific contract. Rather than always sending the full contract text, it first **classifies** each question into one of three context types (`contract` / `history` / `both`), then retrieves only the context that type requires and answers with a system prompt matched to that source. This is the second highest-risk AI component (PRD Risk Level: Medium-High) because free-form Q&A has more surface area for hallucination than structured extraction.

## User Flow

1. User opens the "Chat" tab on the results page. If no `chat_sessions` row exists yet for this contract, one is created lazily on first message.
2. User types a question and submits.
3. Frontend appends the user message optimistically (right-aligned) and shows a loading indicator.
4. `chat` Edge Function: **loads the full prior conversation history for the session before writing the new user message** (see Critical Implementation Requirement below), classifies the new question against that history, retrieves the matching context, calls GLM-4.7 (via Z.ai) with the type-matched system prompt, parses out the mandatory `[Page X]` citation (contract/both only), then writes both the user message and assistant response — including the classification result as `context_source` — to `chat_messages` together.
5. Frontend receives the assistant response (also delivered via the Realtime subscription, so multi-tab sessions stay in sync) and renders it left-aligned with a source badge (from `context_source`) and, when present, the page citation as a clickable link that sets `targetPage` on the document viewer.

### Critical implementation requirement

The full conversation history **must** be read from `chat_messages` before the new user message is inserted. If the new message is saved first and then included when the history is fetched, the classifier will see it as part of its own history and misclassify the turn. Order in the Edge Function: `1) fetch history → 2) classify → 3) build context → 4) call GLM → 5) insert user + assistant messages together`.

## Per-Component AI Contract

| Property | Value |
|---|---|
| Provider | GLM-4.7 via Z.ai (`https://api.z.ai/api/paas/v4/chat/completions`) |
| Model | `glm-4.7-flash` |
| Temperature | `0.4` |
| Max output tokens | `1000` |
| Input | Type-matched system prompt + conditional context (see Retrieval below) + new user message |
| Output | Free text. `contract`/`both` answers must end with a `[Page X]` citation, or be exactly "I cannot find this in the document." when the answer is absent. `history` answers must end with `[From conversation]`. |

### Query classification (no extra model call)

A lightweight heuristic (regex/keyword pass in `lib/openai/prompts/classify-query.ts`) runs before the GLM call, against the history loaded in step 1 (see Critical Implementation Requirement above) and the new question text:
- Matches phrases like "you said", "earlier", "what did you mean", "we discussed" → `HISTORY`
- Matches phrases like "the contract", "this document", "the NDA/MSA" (and no history-referencing phrase is present) → `CONTRACT`
- Ambiguous questions that match neither pattern (e.g. "what does that mean in practice?") → default to `BOTH` rather than guessing `CONTRACT` — safer to include conversation context than silently drop it
- Matches a combination (a history-referencing phrase co-occurring with a document-referencing phrase, e.g. "does that match what the contract says") → `BOTH`

### Retrieval (by classification)

| Type | Context sent | History depth |
|---|---|---|
| `CONTRACT` | `contract_text` + recent conversation turns | last 10 turns |
| `HISTORY` | conversation turns only — **no `contract_text`** | last 20 turns |
| `BOTH` | `contract_text` + recent conversation turns | last 10 turns |

### System prompts (`lib/openai/prompts/chat.ts`)

```
CONTRACT:
"You are ContractIQ's contract assistant. Answer the user's question about the
following {NDA|MSA} contract using ONLY the document text provided below.
If the answer is not in the document, respond exactly: 'I cannot find this in
the document.' Every substantive answer must end with a citation in the form
[Page X], where X is the page number (from the [PAGE N] markers) the answer
was drawn from. Do not use general legal knowledge or speculate.

--- CONTRACT TEXT ---
{contract_text}"

HISTORY:
"You are ContractIQ's contract assistant. Answer the user's question using
ONLY the prior conversation turns provided below — do not reference or infer
anything from the contract document itself. End your answer with
'[From conversation]'."

BOTH:
"You are ContractIQ's contract assistant. Answer using both the contract text
and the prior conversation below. Attribute each fact in your answer to its
source inline — write '(from the contract)' or '(from our conversation)' next
to the relevant part of the answer. Do not use general legal knowledge.

--- CONTRACT TEXT ---
{contract_text}"
```

Message array construction: `[{ role: 'system', content: <type-matched prompt> }, ...history.slice(-N).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: newMessage }]`, where `N` is 10 or 20 per the Retrieval table above.

### Source attribution

The classification result is persisted as `chat_messages.context_source` (`contract` | `history` | `both`, null for user-authored rows) and returned in the API response so the frontend can render a badge showing where the answer came from.

## Data Model

Uses `chat_sessions` and `chat_messages` (see `supabase-schema.sql`). `chat_sessions.contract_id` is unique — one session per contract at MVP.

## DB Tasks

None beyond `supabase-schema.sql`. Enable Realtime on the `chat_messages` table (Database > Replication in the Supabase dashboard, or `alter publication supabase_realtime add table chat_messages;`) so the frontend subscription in the State Management section receives INSERT events.

## API Contract

### `POST /functions/v1/chat`

- **Auth:** required; caller must own the contract
- **Request:**
  ```json
  { "contract_id": "uuid", "message": "Is there an auto-renewal clause?" }
  ```
- **Response 200:**
  ```json
  { "message_id": "uuid", "role": "assistant", "content": "Yes — the agreement auto-renews for successive 12-month terms unless either party gives 30 days' notice. [Page 3]", "page_citation": 3, "context_source": "contract" }
  ```
- **Validation rules:** `message` non-empty, ≤ 2,000 chars → else `422 { "error": "invalid_message" }`; rate limit ≤ 30 chat messages per user per rolling hour → else `429`
- **Errors:** `401`, `404 { "error": "contract_not_found" }`, `422`, `429`, `504 { "error": "chat_timeout", "message": "That took too long — please try again." }` (no partial message pair is written — the user's message and the assistant's response are written together only on full success, so a failed turn never leaves an orphaned user message with no reply)
- **Lazy session creation:** if no `chat_sessions` row exists for `contract_id`, create one before processing the first message.

## State Management (Frontend)

- `useChatMessages(sessionId)` — TanStack Query hook for the initial fetch (`GET /rest/v1/chat_messages?session_id=eq.:id&order=created_at.asc`), seeded into the cache.
- A Supabase Realtime channel (`supabase.channel('chat:' + sessionId).on('postgres_changes', { event: 'INSERT', table: 'chat_messages', filter: 'session_id=eq.' + sessionId }, ...)`) pushes new rows directly into the same TanStack Query cache via `queryClient.setQueryData`, so multi-tab / multi-device sessions stay consistent without polling.
- Sending a message is a mutation (`useSendChatMessage`) that optimistically appends the user's message locally before the server confirms (the assistant's reply arrives either in the mutation response or via the Realtime event, whichever resolves first — deduplicated by `message_id`).

## Component Spec

| Component | File | Responsibility |
|---|---|---|
| `ChatTab` | `components/results/ChatTab.tsx` | Container; loads history, mounts the Realtime subscription |
| `ChatMessageList` | `components/results/ChatMessageList.tsx` | Virtualized list (only needed once a session exceeds ~50 messages); renders `ChatMessageBubble` per message |
| `ChatMessageBubble` | `components/results/ChatMessageBubble.tsx` | Right-aligned for `role='user'`, left-aligned for `role='assistant'`; renders `page_citation` as a clickable link that calls `onPageClick` |
| `ChatInput` | `components/results/ChatInput.tsx` | Textarea + send button; disables while a response is pending; enforces the 2,000-char limit client-side |

## Design

User bubbles: `Blue 50` background, `Grey 900` text, right-aligned, `Radius-LG (8px)`. Assistant bubbles: `Grey 25` background, `Grey 900` text, left-aligned, same radius. Page citation renders as an inline `Blue 500` link with no underline, `Paragraph Small Regular`. Chat input follows the same input styling as elsewhere (`Radius-MD`, `Blue 500` focus ring).

## Edge Cases

- **Question unrelated to the document:** model returns "I cannot find this in the document." — this is validated by the automated hallucination regression test in `ai-eval-guardrails-spec.md` and must never be treated as an error state in the UI; it renders as a normal assistant bubble.
- **Chat response exceeds 15s P95:** the standard 3-attempt backoff applies to transient GLM API errors; a genuinely slow single call still counts toward the Edge Function's timeout — on timeout, return `504` per the API contract above rather than leaving the client waiting indefinitely.
- **Message history exceeds retrieval depth (10/20 turns):** only the most recent turns per the Retrieval table are sent to the model; all messages remain queryable/displayable in the UI (the cap is a model-context optimization, not a data-retention limit). The full session history (≤200 messages) is still fetched from the DB on every turn so the classifier has complete context to work from, even though only a slice is forwarded to GLM.
- **User sends two messages in rapid succession before the first reply returns:** `ChatInput` disables itself while a request is in flight, preventing out-of-order concurrent turns for the same session.
- **Realtime channel disconnects (network blip):** on reconnect, `useChatMessages` refetches the full history to reconcile any missed events, rather than relying solely on the stream.
