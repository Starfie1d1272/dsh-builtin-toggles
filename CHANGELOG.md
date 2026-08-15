# Changelog

## 0.3.0

- Hardened the textual profile writer for quoted/reordered ids, ambiguous YAML,
  symlink/non-regular patch paths, and final locked file checks.
- Froze the Inspection API v1 profile-provenance and compatibility semantics;
  diagnostics now redact external Loader identities.
- Added reviewed-baseline verification, Node 22.19/24 package validation, and
  scheduled upstream compatibility observation.
- Documented security reporting, review maintenance, and restore-inheritance
  cleanup before uninstalling.
