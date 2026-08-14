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
reviewed package identity changes, or a reviewed `inject` declaration changes;
and `unverified` when a reviewed expectation is intentionally incomplete.
The rc.6 roster has exact package assertions only where the published Web
patch directly supplied them. Other roster ids remain expected for presence,
but surface `baseline_package_unknown` rather than claiming a package identity
that this plugin did not independently review.

Review input is exposed as `baseline.reviewedReference` when available: the
published `@deepseek-ai/dsh-web-app@0.1.0-rc.6` `cordis.patch.yml`. At review
time, current upstream `master` (2026-08-13) still declared the base/Web bundle
manifests as rc.5 while npm served rc.6. That discrepancy is why version
equality is deliberately not a compatibility predicate; runtime composition,
module identity, and declared injection evidence are checked instead.

PR 1 is inspection only. Compatibility results intentionally do not change
current toggle or reset behavior; using them to tighten mutation is deferred
to PR 2 after a separate policy review.
