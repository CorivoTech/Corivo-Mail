# Corivo Mail — Blueprint Implementation Contract

This file is the single source of truth for parallel implementation work against the
Corivo Mail Product & Technical Blueprint (Nov 8, 2026). **Do not edit files owned by
another workstream.** All new records are already defined in `src/shared/types.ts` and
seeded in `src/server/db/seed.ts`.

## Global rules

1. **File ownership is exclusive.** Never edit a file assigned to another workstream.
   If you need a change in someone else's file, note it in your final report instead.
2. **No edits to `src/shared/validation.ts`, `src/shared/types.ts`, `src/server/db/seed.ts`,
   `src/server/db/store.ts`, `server.ts`, `src/App.tsx`.** Define Zod schemas locally in
   your own route file (existing pattern: `mail.ts`, `admin.ts`).
3. **Persistence** always via `getDb()` / `updateDb((d) => …)` from `../db/store.ts`.
   Mutations must call `updateDb` so the JSON store is written atomically.
4. **Auth guards**: `requireAuth`, `requireOrganisationMember`, `requirePermission('…')`,
   `requireOrgOwner`, `requirePlatformAdmin` from `../middleware/auth.ts`.
   Audit with `recordAudit(req, orgId, actorId, email, action, resource, 'SUCCESS'|'DENIED'|'FAILED', category)`.
5. **Style**: TypeScript, 2-space indent, Express `Router()`, exported as
   `export const xRouter = Router()`. Sanitise user HTML with `sanitizeHtml` from
   `../../shared/validation.ts`. Validate every body with Zod and return
   `res.status(400).json({ error: '…' })` on failure.
6. **Multi-tenant isolation is mandatory**: every read/write scoped by
   `ctx.organisation.id` (and mailbox/user where applicable). Cross-tenant access → 404.
7. **Tests**: create your OWN test file `tests/<workstream>.test.ts` modelled on
   `tests/corivo.test.ts` (node:test, temp `CORIVO_DATA_DIR`, mount your router).
   Do not modify `tests/corivo.test.ts`.
8. **Honesty**: where an integration cannot really run locally (SMTP relay, Razorpay,
   CalDAV, IMAP migration), implement the full state machine and persist real records,
   and label the simulated leg in API responses as `"DEVELOPMENT_SIMULATED"` /
   `"SANDBOX"` — matching the existing convention. Never return fabricated success
   without persisting a record.
9. Verify your work with `npx tsc --noEmit` (must stay clean).

## Backend endpoint contract

### B1 — Security & identity → `src/server/routes/security.ts` (new) + `src/server/routes/auth.ts`

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/2fa/status` | `{ enabled, confirmed, qrCodeUri, secret? }` — secret only while enrolment pending |
| POST | `/api/2fa/enrol` | Generate base32 TOTP secret + `otpauth://` URI, store pending (not enabled) |
| POST | `/api/2fa/verify` | Body `{ code }` — validate TOTP (±1 step), set `enabled`, `confirmedAt` |
| POST | `/api/2fa/disable` | Body `{ code }` or `{ password }` — disable and clear secret |
| GET | `/api/app-passwords` | List current user's app passwords (never the secret) |
| POST | `/api/app-passwords` | Body `{ label }` → generate `crvm-xxxx-xxxx-xxxx`, return **once**, store `hashPassword()` |
| DELETE | `/api/app-passwords/:id` | Revoke (set `revokedAt`) |
| POST | `/api/app-passwords/verify` | Body `{ prefix, password }` → `{ valid }` (for IMAP/SMTP client auth) |
| GET | `/api/ip-allowlist` | Org IP allow-list entries |
| POST | `/api/ip-allowlist` | Add entry (IPv4/IPv6/CIDR validation, `requirePermission('security.manage')`) |
| DELETE | `/api/ip-allowlist/:id` | Remove entry |
| GET | `/api/sso` | Current org SSO config or `{ configured: false }` |
| PUT | `/api/sso` | Upsert SSO provider (SAML/OIDC fields), `requirePermission('security.manage')` |
| DELETE | `/api/sso/:id` | Remove SSO config |
| GET/POST/DELETE | `/api/push-subscriptions…` | Web push subscription register/list/remove for current user |

**Auth flow change (`auth.ts`)**: after password validation succeeds, if the user has an
enabled TOTP record **or** the org has `enforce2fa` with a confirmed record, do **not**
issue a session. Instead persist a `TwoFactorChallenge` (hashed token, 10-minute expiry)
and return `202 { requiresTwoFactor: true, challengeToken }`. New endpoint
`POST /api/auth/2fa/verify` body `{ challengeToken, code }` validates TOTP and then runs
the existing session-issuing block. Rate-limit TOTP attempts (reuse the login limiter).
**IP allow-list enforcement**: when the org has entries, a login from a non-matching IP is
rejected `403` with a `SECURITY` event, except for `isPlatformAdmin` users. Also expose
`GET /api/auth/2fa/status?challengeToken=` if the login UI needs it.

TOTP implementation must be dependency-free: base32 encode/decode + HMAC-SHA1 TOTP
(RFC 6238, 30s step, 6 digits, ±1 window) via `node:crypto`.

### B2 — Mail automation → `src/server/routes/mailAutomation.ts` (new) + `src/server/routes/mail.ts`

| Method | Path | Behaviour |
|---|---|---|
| GET/POST | `/api/mail/rules` | List/create rules for current mailbox |
| PATCH/DELETE | `/api/mail/rules/:id` | Update/toggle/delete |
| POST | `/api/mail/rules/:id/run` | Apply rule to existing messages, returns moved/updated count |
| GET/POST | `/api/labels` | List/create mail labels (name + colour) |
| PATCH/DELETE | `/api/labels/:id` | Rename/recolour, delete (removes assignment) |
| POST | `/api/mail/:id/labels` | Body `{ labelId, applied }` — add/remove label on a message |
| GET/POST/PATCH/DELETE | `/api/auto-reply…` | Auto-reply/vacation CRUD for mailbox (single record) |
| GET/PATCH | `/api/mail/forwarding` | Automatic forwarding addresses + `keepCopy` (validate addresses, max 5) |
| GET | `/api/mail/outbound` | Current user's outbound queue (undo/scheduled items) |
| POST | `/api/mail/schedule` | Body = send payload + `scheduledAt` (future) → queue item `SCHEDULED` |
| POST | `/api/mail/outbound/:id/cancel` | Cancel `PENDING_UNDO` or `SCHEDULED` item |
| POST | `/api/mail/:id/comments` | Add internal comment; GET list; DELETE own comment |
| POST | `/api/mail/:id/spam` | Body `{ isSpam }` — report spam / not spam (folder move + security event) |
| POST | `/api/mail/read-all` | Mark all messages in a folder read |
| GET | `/api/mail/threads` | Thread-grouped list for current mailbox (folder-scoped, newest per thread) |

**`mail.ts` integration (required):**
- `POST /api/mail/send` accepts optional `undoWindowMs` (max 30 000) and `scheduledAt`.
  When either is present, persist an `OutboundQueueItem` (`PENDING_UNDO` /
  `SCHEDULED`) and return `202 { queued: true, queueId, undoUntil }` **without** sending.
  Default undo window = 10 000 ms when the client does not opt out.
- New endpoint `POST /api/mail/send/cancel/:queueId` cancels within the undo window.
- **Worker**: export `runOutboundQueueTick()` and `runMailboxMaintenanceTick()` from
  `mailAutomation.ts`; `mail.ts` (or the automation router via `app.locals`) is fine — the
  ticks will be invoked by a scheduler I wire in `server.ts`. They must:
  release due `SCHEDULED`/expired `PENDING_UNDO` items through the existing
  `sendOutboundEmail` path (export it or refactor it so it can be reused),
  and restore `snoozed` messages whose `snoozedUntil` has passed back to `inbox`.
- **Inbound delivery**: when a message is delivered to an internal mailbox, apply in order:
  distribution-group/alias expansion (an alias recipient delivers to its `targetAddress`,
  a group delivers to every member), then `mailRules` (enabled, `stopProcessing` honoured),
  then auto-reply (respect `audience`, date window, and `lastTriggeredAt` guard — reply to
  the sender with the auto-reply body, never looping), then mailbox forwarding
  (send a copy to each configured address, `keepCopy` decides whether the original stays).
- **Signature**: append `preferences.signatureHtml` server-side on send when
  `signatureEnabled` and the body does not already contain it.
- **Shared mailboxes**: `POST /api/mail/send` accepts optional `fromSharedMailboxId`;
  allowed only for org members listed on that shared mailbox with `SEND_AS`/`READ_WRITE`.
  New endpoint `GET /api/shared-mailboxes/:id/messages` returns messages addressed to the
  shared address (mailbox-scoped via org membership + permission check).

### B3 — Admin, billing & platform API → `src/server/routes/admin.ts`, new `billing.ts`, new `platformApi.ts`

`admin.ts` additions:

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/admin/users/import` | Body `{ csv }` — parse `firstName,lastName,username,domainId,roleKey,quotaMb`; create user+membership+mailbox per valid row; return `{ created[], failed[{row,error}] }`; harden against CSV formula injection; `requirePermission('mailboxes.create')` |
| DELETE | `/api/admin/users/:userId` | Remove membership + mailbox + messages/folders/drafts + user; block deleting OWNER/self; audit |
| PATCH | `/api/domains/:id` | Accept `catchAllAddress` / `catchAllEnabled` (already-updating route) |
| DELETE | `/api/domains/:dnsId/records/:id` | Remove a single DNS record (org-scoped) |
| GET/PUT | `/api/admin/retention` | Retention policy read/update (audit log retention days, message retention, legal hold) |
| POST | `/api/admin/audit-logs/purge` | Apply retention (delete audit rows older than N days, skip when legal hold) |

Also fix `DELETE /api/mailboxes/:id` so it removes the owning user + membership when that
user has no other mailbox (no orphans).

`billing.ts`:

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/billing/plans` | `BILLING_PLANS` catalog from `../db/seed.ts` |
| GET | `/api/billing/subscription` | Current org subscription + trial state (auto-create TRIAL subscription on first read if none) |
| POST | `/api/billing/subscription` | `{ planCode, seats }` — change plan (owner only), recompute renewal, audit |
| POST | `/api/billing/trial` | Start free trial for the plan (once per org) |
| GET | `/api/billing/invoices` | List org invoices, newest first |
| POST | `/api/billing/invoices` | Generate GST invoice for the current period from subscription seats (idempotent per period) |
| GET | `/api/billing/invoices/:id` | Invoice detail |
| GET | `/api/billing/invoices/:id/download` | Render invoice as HTML (printable GST invoice) |
| POST | `/api/billing/payments` | Create sandbox payment intent `{ invoiceId, provider, method }` → `CREATED` |
| POST | `/api/billing/payments/:id/confirm` | Sandbox confirm → `PAID`, marks invoice `PAID`, writes audit + webhook event |
| GET | `/api/billing/payments` | Payment history |

GST: `gstRate = 18`, `gstInr = round(subtotal * 0.18)`, `totalInr = subtotal + gstInr`.

`platformApi.ts`:

| Method | Path | Behaviour |
|---|---|---|
| GET/POST | `/api/api-tokens` | List / create org API token (`crvm_live_<hex>`, shown once, stored hashed), scopes |
| DELETE | `/api/api-tokens/:id` | Revoke |
| GET/POST | `/api/webhooks` | List / create endpoint (auto-generate `whsec_` secret, validate https URL) |
| PATCH/DELETE | `/api/webhooks/:id` | Update url/events/status, delete |
| POST | `/api/webhooks/:id/test` | Deliver a signed `ping` event, persist a `WebhookDelivery` |
| GET | `/api/webhooks/deliveries` | Recent delivery attempts |
| GET | `/api/integrations` | Marketplace catalog **+** installed status per org |
| POST | `/api/integrations/:id/install` | Enable + persist config |
| POST | `/api/integrations/:id/uninstall` | Disable |
| GET/POST | `/api/v1/…` | **Public API** authenticated by `Authorization: Bearer crvm_live_…` (hash lookup, reject revoked/expired, stamp `lastUsedAt`): `GET /api/v1/mailboxes`, `GET /api/v1/domains`, `GET /api/v1/messages?folder=`, `POST /api/v1/messages` (send), `GET /api/v1/audit-logs` (scope-gated) |

Expose `emitWebhook(orgId, event, payload)` from `platformApi.ts` so other routers can
record deliveries for `mail.bounced`, `domain.verified`, `billing.invoice_issued`, etc.
(B3 wires it into its own routes; other workstreams may skip it.)

### B4 — Workspace modules → `src/server/routes/workspaceModules.ts`

| Method | Path | Behaviour |
|---|---|---|
| GET/POST | `/api/contact-groups` | List/create groups for current user |
| PATCH/DELETE | `/api/contact-groups/:id` | Rename/delete (reassign contacts to uncategorised) |
| POST | `/api/contacts/import` | Keep working; also register imported names in `contactGroups` |
| GET | `/api/calendar?includeShared=1` | Also return events where the user is in `sharedWith` or is an attendee of another member's event |
| POST | `/api/calendar` | Accept `sharedWith: string[]` and `sendInvite: boolean`. When `sendInvite`, create `rsvpToken`, seed `responses` as `NEEDS_ACTION`, and deliver an invitation email to every attendee (internal recipients get a real message row; external recipients get a persisted `DeliveryEvent` in `DEVELOPMENT_SIMULATED` mode) |
| POST | `/api/calendar/:id/rsvp` | Body `{ token, status }` — record attendee response (public-safe, token-scoped) |
| GET | `/api/calendar/caldav` | CalDAV setup info: server URL, principal path, username, requirement to use an app password |
| GET | `/api/contacts/carddav` | CardDAV setup info (same shape) |
| PATCH/DELETE | `/api/shared-mailboxes/:id` | Edit name/description/members, delete |
| POST | `/api/migration` | Replace instant fake completion with a persisted state machine: `QUEUED` → `RUNNING` with `successCount` advancing on each poll → `COMPLETED`/`PARTIAL` driven by `totalItems`; validate credentials shape; keep `DEVELOPMENT_SIMULATED` in the response |
| POST | `/api/migration/:id/cancel` | Cancel a running job |
| GET | `/api/migration/:id` | Job detail with live progress |

Remove the static `GET /api/integrations` handler from this file (B3 provides the real one).

## Frontend contract (Wave 2)

Each frontend workstream edits **only** its assigned page files, exports the components
listed below by name, and does **not** touch `src/App.tsx`, `src/components/layout/AdminLayout.tsx`,
or `src/context/*`. Route wiring and navigation links are applied centrally afterwards.

| Workstream | Own files | Must export |
|---|---|---|
| **F1 Mail workspace** | `src/pages/workspace/MailWorkspacePage.tsx`, `src/components/mail/ComposeModal.tsx`, `src/components/layout/WorkspaceShell.tsx` | (existing exports) — add undo-send toast + scheduled-send in compose, snooze date/time picker menu, report spam/not-spam, mark-all-read, labels rail + label picker, internal comments panel on the open thread |
| **F2 Settings & account** | `src/pages/settings/SettingsPages.tsx`, `src/pages/account/AccountPages.tsx` | `MailRulesSettingsPage`, `AutoReplySettingsPage`, `ForwardingSettingsPage`, `LabelsSettingsPage`, `ScheduledMailPage`, `AppPasswordsPage`, `TwoFactorPage` (existing exports unchanged) |
| **F3 Admin console** | `src/pages/admin/AdminOperationsPages.tsx`, `src/pages/admin/AdminMailboxesUsersPages.tsx`, `src/pages/admin/AdminDomainsPages.tsx` | `AdminBulkImportPage`, `AdminApiKeysPage` (tokens+webhooks+API docs), catch-all editor inside `AdminDomainDetailPage`, wired Billing, wired Integrations, SSO + IP allow-list + retention inside `AdminSecurityPage` tabs |
| **F4 Public & workspace modules** | `src/pages/public/MarketingPages.tsx`, `src/pages/public/legal/*` (new), `src/pages/workspace/WorkspaceModulesPages.tsx`, `src/components/layout/PublicLayout.tsx` | `TermsPage`, `PrivacyPage`, `AcceptableUsePage`, `DeveloperApiPage`; calendar invite/shared/CalDAV UI; contact groups UI; shared-mailbox edit/delete; migration progress UI |

New routes that will be wired centrally (expect these paths):

```
/terms  /privacy  /acceptable-use  /developers
/app/settings/rules  /app/settings/auto-reply  /app/settings/forwarding
/app/settings/labels  /app/settings/scheduled  /app/account/app-passwords  /app/account/2fa
/admin/bulk-import  /admin/api-keys
```

Frontend rules: use `apiFetch` from `src/lib/api.ts`, TanStack Query where the page
already uses it, existing primitives from `src/components/ui/Primitives.tsx`, toast via
`useToast()` from `src/context/ToastContext.tsx`. Keep the existing visual language
(navy/blue palette, `text-sm`, rounded-xl cards). Any simulated backend leg must be
labelled in the UI with the existing `SANDBOX` / `DEVELOPMENT_SIMULATED` chips.
