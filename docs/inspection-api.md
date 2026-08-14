# Inspection API v1

`GET /api/builtin-toggles/v1/inspection` is a same-origin, read-only API. It
uses the existing trust fence and reports Loader rows even when they are new,
external, or unreviewed. Its stable machine contract starts with
`schemaVersion: "builtin-toggles.inspection/v1"`.

The response contains a semantic capability inventory, the reviewed DSH Web
baseline, and a compatibility summary. It deliberately contains no localized
labels. `policy.status` is only a projection of the explicit allowlist. The
server also returns `configuration` (profile override state, independent
profile-persistence preflight, effective Loader disabled result, and separately
labelled Agent Preset ownership) and a
server-computed `mutationEligibility` for every row. The browser never derives
eligibility from compatibility or catalog text.

`configuration.profileOverride.state` is one of `inherited`,
`explicitly-enabled`, or `explicitly-disabled`. It is deliberately distinct
from Loader lifecycle and `effectiveDisabled`; it describes only the Web
profile patch's literal top-level `disabled` override. Agent Preset ownership
is a different management plane and is reported as `agentPresetManaged`, not
mislabelled as a profile override. A malformed/ambiguous profile override is
shown as `unavailable` and is never writable.

`configuration.profilePersistence` is separate from that state: a missing
profile patch is still semantically `inherited`, but reports
`status: "unwritable"` because this plugin will not create it implicitly. The
same conservative preflight is used by GET eligibility and POST before any
Loader update. It rejects known writer refusal conditions (missing/unreadable
file, duplicate target row or `disabled` field, and non-literal `disabled`),
while the final writer still repeats its lock, atomic write, and optimistic
concurrency checks at commit time.

The GET route reads and `lstat`s the profile patch once, then derives all
capability override/preflight values from that coherent text snapshot. Quoted
or reordered ordinary top-level ids are recognized without rewriting their
spelling. An id form the textual writer cannot safely explain, a symlink, or a
non-regular patch path is unavailable/unwritable. GET is never a write cache:
POST performs fresh preflight and repeats file type, identity, mode, read, and
optimistic-concurrency checks under the official writer lock.

Compatibility is `verified` only when a stable, Host-owned runtime release
identity matches the reviewed rc.6 target **and** every evaluated structural
assertion matches. Identity is necessary but not sufficient: it is combined
with the roster, exact module identity, and reviewed `inject` checks.
`drifted` applies when an expected entry is missing, a new official entry
appears, a reviewed package identity or `inject` declaration changes, the
runtime contains a duplicate Loader id, **or** a trustworthy runtime identity
mismatches. `unverified` means no difference was observed but a reviewed
expectation or runtime identity proof is incomplete. `verifiedCount`,
`driftedCount`, and `unverifiedCount` count entry assertions only; composition
identity is reported separately and never contributes a fictional entry.
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

## Mutation eligibility

Compatibility and eligibility intentionally answer different questions.
`compatibility.status === "verified"` is **not** the authorization condition:
live inspection remains `unverified` when release identity is unavailable, yet
an existing reviewed UI leaf can still be eligible. Every POST independently
requires all of the following:

- the exact `MANAGEABLE_IDS` member and an existing runtime entry;
- exact reviewed package identity and a complete `reviewed-safe-ui-leaf`
  conclusion (including reviewed provenance and observed empty dependency
  evidence);
- no target package, inject, or duplicate-id structural finding;
- no global structural finding that could invalidate the leaf assumption;
- a writable profile-patch preflight for that exact target row;
- request trust, strict action/body schema, self protection, process queue,
  atomic profile writer lock, optimistic concurrency, and persistence rollback.

The public Loader seam does not expose a provider/consumer graph. It therefore
cannot establish that a newly observed official entry, or another observed
composition change, is not a new consumer of a reviewed leaf. Such a finding
denies mutation (`global_structural_drift`) rather than being ignored. This is
also exposed as the non-authorizing `consumer_graph_not_exposed` limitation;
the implementation only fails closed on observable structural drift and does
not claim to detect fully unobservable future internal-code or consumer
changes. A
positive Host release-identity mismatch also denies. Identity merely being
unavailable remains a limitation rather than a fabricated `verified` result or
a blanket permanent shutdown of the nine audited leaves.

POST accepts strict explicit actions `{ "action": "force-enable" }`,
`{ "action": "force-disable" }`, and `{ "action": "restore-inheritance" }`.
The legacy `{ "disabled": boolean }` body remains supported and maps to the
matching force action. Restore removes only the literal `disabled` field in
the exact top-level profile row; unrelated fields, comments, line endings,
`!!js`, and nested `insert` rows remain untouched. If the minimal row becomes
empty it is removed while the empty profile remains a valid `[]` sequence.
Restore intentionally does not call `entry.update({ disabled: null })`: real
Cordis Loader semantics only remove that entry's current option. The atomic
profile change is instead reconciled through DSH's established profile/HMR
watcher, which recomposes the complete patch layer and thereby re-exposes a
lower inherited `disabled` value when present. A successful restore DTO only
means the profile operation committed; it does not claim that an already-open
runtime has synchronously converged. The client re-reads inspection afterward.
