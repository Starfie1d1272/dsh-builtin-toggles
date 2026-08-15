# dsh-builtin-toggles — Evidence-backed Built-in Capability Inspector

[简体中文](README.md) | English

An evidence-backed built-in capability Inspector for DeepSeek Harness Web. Its nine reviewed UI controls are a deliberately tiny, fail-closed adjunct—not a general plugin switcher.

> Unofficial community plugin. It is not affiliated with or supported by DeepSeek Harness.

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
[![npm version](https://img.shields.io/npm/v/dsh-builtin-toggles?logo=npm)](https://www.npmjs.com/package/dsh-builtin-toggles)
[![CI](https://github.com/Starfie1d1272/dsh-builtin-toggles/actions/workflows/ci.yml/badge.svg)](https://github.com/Starfie1d1272/dsh-builtin-toggles/actions/workflows/ci.yml)

Find it under **Settings → Plugins → Built-ins**. The Host generates the inspection: reviewed evidence, profile overrides, persistence preflight, compatibility, and mutation eligibility are server-computed. The old catalog screenshot no longer represented the product and was removed rather than replaced with an illustration.

## Install

Prerequisite: an initialized DSH `web` profile. Later public DSH releases may still install or run, but do not become a supported/reviewed baseline without an explicit review.

With the `dsh` CLI installed:

```sh
dsh plugin --profile web add dsh-builtin-toggles
dsh web
```

With npx (no global `dsh` install needed):

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-builtin-toggles
npx @deepseek-ai/dsh web
```

Restart the DSH web/gateway so it reads the bundle at startup.

## What it does

- **Capability Inspector / Doctor**: inspects every current Web Loader capability, including external, unreviewed, and anomalous rows. It presents runtime state, profile-override tri-state, Agent Preset ownership, review provenance, dependency evidence, compatibility, and server-computed mutation eligibility.
- **Filters and diagnostics**: filters by ID/package, category, management plane, policy, verification, runtime, and anomalies; copied diagnostics redact local paths and configuration contents.
- **Agent Preset plane**: capabilities such as `tool-*` and `plan-mode` are assembled per session by Agent Presets and are never presented as profile overrides.
- **Nine reviewed UI controls**: only `ui-deliverables`, `ui-jobs`, `ui-goal`, `ui-message-feedback`, `ui-model-selection`, `ui-agent-preset`, `ui-skill`, `ui-subagent`, and `ui-trajectory`. These presentation leaves apply to the Web profile and all its sessions, do not edit Agent Presets, persist force actions, and restore inheritance through DSH profile/HMR recomposition.
- **Fail closed**: core services, Agent capabilities, third-party, and unknown entries remain locked. This package has no generic plugin manager, marketplace, or plugin install/update lifecycle.
- **Inspection API v1**: `GET /api/builtin-toggles/v1/inspection` is the stable, presentation-free machine interface for inventory, reviewed baseline, configuration state, compatibility, and eligibility. See [Inspection API v1](docs/inspection-api.md).

## Security and transport access

Manageability comes solely from the exact `MANAGEABLE_IDS` allowlist in `src/policy.ts`. Every POST repeats server-side checks for policy, body, entry, `@deepseek-ai/*` package identity, self protection, eligibility, and the profile writer; the browser is never an authorization boundary.

Loopback and explicitly trusted hosts can read the API. Configuration mutation additionally requires loopback same-origin access. `trustedHosts` mitigates DNS rebinding; it is **not authentication**. v1 `access.mutation` reports the authoritative request-scoped transport decision, separately from per-capability `mutationEligibility`. A remote Inspector is read-only.

## Compatibility and support policy

- The only reviewed/tested baseline is the published `@deepseek-ai/dsh-base@0.1.0-rc.6` and `@deepseek-ai/dsh-web-app@0.1.0-rc.6` artifacts, not a `>= rc.6` version-range promise.
- Later public releases may still install or run, but are not a supported/reviewed baseline before explicit review. The current-public workflow only produces an observational drift report; it never upgrades support.
- When a live Host lacks a stable public runtime release identity, inspection honestly remains `unverified`; it never guesses from module paths, private fields, or a version string.
- Compatibility and mutation eligibility are distinct: missing identity never fabricates a verified claim, and each mutation still needs independent safe-leaf, structural-drift, and writer checks.

See [COMPATIBILITY.md](COMPATIBILITY.md) for review boundaries and [SECURITY.md](SECURITY.md) for reporting.

## For distributions / integrators

- Package identity: `dsh-builtin-toggles`; display product: **Evidence-backed Built-in Capability Inspector**; Web profile only.
- Pin exact reviewed versions rather than drifting automatically. The reviewed baseline is the rc.6 artifacts above; the distribution/integrator remains responsible for an explicit baseline and compatibility review.
- The v1 read API is a stable machine interface. Trusted-host inspection is read-only, configuration mutation is loopback-only, and all mutation fails closed.
- This package does not manage third-party plugin lifecycles, provide a marketplace, or edit Agent Presets. Before uninstalling, use **Restore inheritance** on any item this package forced, which removes only its top-level literal `disabled` override.

## Uninstall

With the `dsh` CLI installed:

```sh
dsh plugin --profile web remove dsh-builtin-toggles
```

With npx:

```sh
npx @deepseek-ai/dsh plugin --profile web remove dsh-builtin-toggles
```

Restart afterward. The package does not remove arbitrary user profile content.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

See [Contributing](CONTRIBUTING.md). MIT.
