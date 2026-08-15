# Security policy

`dsh-builtin-toggles` is a deliberately narrow, fail-closed inspector. Only
the exact reviewed IDs in `src/policy.ts` can ever be mutated; a display label,
prefix, runtime state, or browser request never grants authority.

Read APIs accept loopback and explicitly trusted same-origin authorities.
Configuration mutation repeats the same request fence with an empty
`trustedHosts` set, so it is loopback-only. `trustedHosts` mitigates DNS
rebinding; it is not authentication and never grants remote write access.

Please report suspected authorization bypasses, profile-patch corruption,
trust-fence bypasses, or diagnostic data disclosure privately through GitHub's
repository security advisory flow. Do not include a real `DSH_HOME`, profile,
token, hostname, or private Loader identifier in a public issue.

There is no compatibility promise for unreviewed upstream DSH versions.
Unknown entries stay locked; an uncertainty in the writer or evidence path is
an unavailable/unwritable result, not a best-effort mutation.
