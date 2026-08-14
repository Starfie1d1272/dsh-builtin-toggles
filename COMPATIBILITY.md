# Compatibility and reviewed baseline

v0.3.0 has one reviewed baseline: the published
`@deepseek-ai/dsh-base@0.1.0-rc.6` and
`@deepseek-ai/dsh-web-app@0.1.0-rc.6` `cordis.patch.yml` artifacts. The
baseline captures the roster, unique ids, exact package identity, and reviewed
declared `inject` values. `pnpm verify:baseline <base-patch> <web-patch>`
rechecks those mechanical claims.

The safe-leaf `provides`/consumer conclusion is intentionally a human review:
the current public Loader seam does not publish a complete consumer graph.
Automation must not upgrade that absence into a proof.

## Updating a reviewed release

1. Obtain the two published npm artifacts and preserve their exact versions.
2. Run the baseline verifier, investigate every roster/package/inject change,
   and separately re-review each candidate leaf's service and consumer impact.
3. Keep new official capability IDs `unknown` and locked until a separate
   architecture/security review explicitly changes the evidence and policy.
4. An allowlist expansion is never a compatibility update; it requires that
   independent review even if the new row looks like a UI plugin.

The scheduled compatibility workflow has two lanes. The rc.6 lane exercises
the frozen artifact evidence and local package gate. The current-public lane
only records the version currently published to npm. It is an early-warning
observation, not an automatic support upgrade, baseline change, or allowlist
change. GitHub source/master is likewise not support evidence.

`verified` means a Host-owned runtime identity and all reviewed structural
evidence match. `drifted` means a direct structural difference or a trusted
identity mismatch. `unverified` means no difference was observed but the proof
is incomplete (for example, the Host exposes no bindable release identity).
The API's entry counts count entry assertions only; composition identity is
reported separately and is never fabricated as an entry.
