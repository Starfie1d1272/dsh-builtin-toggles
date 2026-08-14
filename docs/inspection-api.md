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

Compatibility is `verified` only when every evaluated assertion matches;
`drifted` when an expected entry is missing, a new official entry appears, a
reviewed package identity changes, a reviewed `inject` declaration changes, or
the runtime contains a duplicate Loader id; and `unverified` when a reviewed
expectation is intentionally incomplete. Loader `inject` string arrays are
compared as unordered service sets, matching Cordis injection resolution.

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
