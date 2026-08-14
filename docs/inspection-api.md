# Inspection API v1

`GET /api/builtin-toggles/v1/inspection` is a same-origin, read-only API. It
uses the existing trust fence and reports Loader rows even when they are new,
external, or unreviewed. Its stable machine contract starts with
`schemaVersion: "builtin-toggles.inspection/v1"`.

The response contains a semantic capability inventory, the reviewed DSH Web
baseline, and a compatibility summary. It deliberately contains no localized
labels and no field that authorizes mutation. `policy.status` is a projection
of the existing server policy; `POST` still independently checks the explicit
allowlist, package scope, request trust, serialization, and profile writer.

Compatibility is `verified` only when a stable, Host-owned runtime release
identity matches the reviewed rc.6 target **and** every evaluated structural
assertion matches. Identity is necessary but not sufficient: it is combined
with the roster, exact module identity, and reviewed `inject` checks.
After identity matches, `drifted` applies when an expected entry is missing, a
new official entry appears, a reviewed package identity changes, a reviewed
`inject` declaration changes, or the runtime contains a duplicate Loader id.
`unverified` applies when a reviewed expectation is incomplete or runtime
release identity is unavailable/mismatched; structural findings are still
reported in the latter case, but cannot elevate the summary to `drifted`.
Loader `inject` string arrays are compared as unordered service sets, matching
Cordis injection resolution.

The current public DSH seams available to this plugin do not expose a Host
release identity: `pluginInventory` is deliberately only a Loader-entry
projection, and `webRuntime` supplies Web bind/trust information. The API
therefore reports `runtimeIdentity.status: "unavailable"` and cannot report
`verified` in a live Host today, even when the structural checks match. It does
not resolve another installed package, inspect private Loader fields, or read
source patches to fill that gap. A future public Host metadata seam or immutable
fingerprint can be supplied to the evaluator; until then inspection remains
read-only and fail-closed in its compatibility claim.

The complete rc.6 package-identity baseline comes from the published
`@deepseek-ai/dsh-base@0.1.0-rc.6` and
`@deepseek-ai/dsh-web-app@0.1.0-rc.6` `cordis.patch.yml` files. Its provenance
is explicitly `npm-published-patch`: it is not represented as upstream-source
or live-runtime evidence. A separately started rc.6 Web instance confirmed
browser boot artifacts, but did not expose a complete Loader id-to-package
snapshot; it therefore does not upgrade the patch provenance. Version equality
alone remains insufficient: runtime composition, exact module identity, and
declared injection evidence are checked.

The capability baseline also carries bounded audit observations. Nine current
safe UI leaves are recorded as such, while `ui-commands` records its observed
`commandUi` service and known consumers. Any provides/consumers not established
by that audit remain `unknown`; evidence never grants mutation authority.

PR 1 is inspection only. Compatibility results intentionally do not change
current toggle or reset behavior; using them to tighten mutation is deferred
to PR 2 after a separate policy review.
