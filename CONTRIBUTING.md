# Contributing

[简体中文](CONTRIBUTING.zh-CN.md) | English

Thanks for contributing to dsh-builtin-toggles.

## Project scope

dsh-builtin-toggles focuses on two things:

1. explaining official DeepSeek Harness built-in plugins in human-readable terms;
2. exposing a small, explicitly audited set of safe Web UI toggles.

It is intentionally NOT:

- a general-purpose plugin manager;
- a plugin marketplace;
- an arbitrary Cordis Loader editor;
- an Agent Preset editor;
- a generic configuration editor.

Keep proposed changes within this scope unless a separate design discussion has established a new direction.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

If generated `lib/` output changes, it must exactly match the committed source build.

Also use:

```sh
git diff --check
npm pack --dry-run
```

The npm package intentionally contains only the runtime/package files selected by the package whitelist; documentation such as `docs/` and CONTRIBUTING files does not need to ship in the npm tarball.

## Catalog contributions

Corrections and improvements to built-in plugin:

- names;
- descriptions;
- categories;
- disable impact;
- recommendations;
- lock reasons;
- status explanations

are welcome.

Behavioral claims should include evidence wherever practical, preferably from:

1. current DeepSeek Harness source;
2. an installed DSH runtime;
3. reproducible runtime/browser behavior.

Do not infer safety from naming alone.

The catalog is presentation metadata only.

Catalog metadata MUST NOT:

- grant toggle authority;
- alter MANAGEABLE_IDS;
- act as an authorization source.

Unknown or insufficiently understood entries remain fail-closed.

## Proposing a new manageable toggle

Changes to MANAGEABLE_IDS are security / runtime-policy changes, not ordinary catalog edits.

A proposed manageable entry must demonstrate that it is an optional Web UI / presentation leaf whose disablement does not break:

- DSH core services;
- Agent capabilities;
- Loader/service dependencies;
- required Web infrastructure;
- other dependent built-ins.

A toggle proposal should include appropriate evidence such as:

- dependency and service-consumer review;
- policy tests;
- mutation-path tests;
- fail-closed tests;
- isolated runtime/browser E2E where applicable.

If safety cannot be established confidently, the entry stays locked.

## Agent Preset managed capabilities

Entries shown as managed by Agent Presets are intentionally not exposed as Web-profile toggles merely because they appear disabled at the root Loader level.

Changes involving Agent capabilities should preserve the distinction between:

- Web-profile configuration;
- per-session Agent Preset composition.

Do not turn preset-managed capabilities into independent Loader switches without a separate architecture review.

## Pull requests

Keep PRs focused.

Avoid unrelated refactors or formatting churn.

For user-visible changes:

- update English and Simplified Chinese UI text together where applicable;
- add or update tests for behavior changes;
- explain the evidence behind any change to policy or runtime behavior.

Small catalog/documentation fixes do not need unrelated architecture changes.
