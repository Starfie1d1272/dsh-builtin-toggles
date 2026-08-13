# AGENTS.md

Guidelines for AI agents and humans working in this repository.

## What this project is

`dsh-builtin-toggles` is a narrow DeepSeek Harness (DSH) web plugin. It adds a
third tab — **内置开关 / Built-ins** — inside the existing
`设置 → 插件 (Settings → Plugins)` section. The tab lists official built-in
Loader entries and lets users toggle a tiny, explicitly allowlisted set of
presentation-only Web UI plugins. It is not a plugin marketplace and not a
general plugin manager.

## Three invariants (never break these)

1. **Unknown built-ins are locked by default.**
   Manageability comes exclusively from the exact explicit allowlist in
   `src/policy.ts` (`MANAGEABLE_IDS`). There is no name/heuristic path to
   manageability: a UI-sounding id that is not on the list is locked, an
   allowlisted id whose module is not `@deepseek-ai/*` is locked, and the
   plugin itself is locked. The server re-checks every rule on every POST;
   hiding a button in the UI is never a security boundary.

2. **Model-facing / core infrastructure plugins are never manageable.**
   Loader/Cordis core, modules, connection, api-remotes, client-runtime,
   cordis-client-runner, ui-theme, locale, ui-layout, ui-sidebar, ui-settings,
   ui-settings-general, ui-settings-plugins, ui-conversation, ui-input-trigger,
   ui-tool, plugin-inventory, api-gateway, webserver, web-runtime, client-hmr,
   storage/session/workspace host infrastructure, and the whole agent preset
   plane (`tool-*` / `skill-*` / compaction / subagent model capabilities) are
   never manageable. Do not expand the allowlist; shrinking it is always fine.

3. **Profile patch mutation must preserve unrelated user content.**
   The writer in `src/profile-patch.ts` is textual and line-oriented by
   design: it only touches a top-level `- id: <exact id>` row's own
   `disabled:` field, never nested `insert:` ids, never `config`/`name`,
   never comments, `!!js` expressions, or unrelated rows, and it preserves
   the file's LF/CRLF style. Writes go through a sibling temp file + atomic
   rename with an optimistic-concurrency re-read (an external edit refuses
   the write with 409 instead of being overwritten). Never replace this with
   a generic YAML parse → stringify round trip.

## Layout

- `src/policy.ts` — allowlist + classification + POST gate (pure).
- `src/profile-patch.ts` — conservative textual patch writer (pure render +
  atomic fs layer).
- `src/mutate.ts` — POST orchestration with runtime-first order and rollback
  (pure, dependency-injected).
- `src/index.ts` — host plugin: same-origin API routes, trust fence.
- `src/client/` — browser half: `settings.plugins.tab` registration, tab
  component, zh/en dictionaries.
- `tests/` — node:test specs for policy, patch writer, mutation flow.
- `lib/` — committed build artifacts (node ESM + browser ModuleLoader bundle);
  the package must stay installable without a prepare step.

## Commands

- `pnpm install`
- `pnpm build` — tsdown (node half → `lib/index.mjs`, browser half →
  `lib/client.js`)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — `node --import tsx --test tests/*.spec.ts`

## Rules of the road

- The browser bundle contract is `window.__ModuleLoader__.load({ id, factory })`
  with platform modules resolved through the injected `require` — do not
  invent a different client loading mechanism.
- Client registrations use the official `settings.plugins.tab` slot — never
  a new `settings.section`.
- One toggle mutation at a time (client-side serialization); the server is
  the authority and the UI re-reads snapshots after every attempt.
- No tools, no MCP, no model prompt injection, no third-party plugin
  management. Keep the scope exactly as small as the README describes.
