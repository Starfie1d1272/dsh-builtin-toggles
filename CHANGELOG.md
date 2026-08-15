# Changelog

## 0.3.0

### Positioning

- Evolved from a catalog/toggle utility into an evidence-backed built-in
  capability inspector.

### User-facing

- Added Capability Inspector / Doctor, semantic Chinese and English
  presentation, profile-override tri-state, and a clear separation between
  effective state and the Agent Preset plane.
- Added filters, anomaly diagnostics, redacted diagnostic copy, and restore
  inheritance.
- Retained only 9 reviewed, fail-closed UI controls as a narrow adjunct to the
  Inspector.

### Safety & compatibility

- Recorded the reviewed rc.6 baseline/evidence and separated compatibility
  from mutation eligibility.
- Kept the exact allowlist, hardened profile writes with concurrency checks and
  atomic writes, and made configuration mutation loopback-only.
- Added diagnostics redaction and current-public observational drift reporting.

### Integration / release

- Froze Inspection API v1, validated the npm tarball, and tested the package on
  Node 22.19 and 24.
- Added the real rc.6 gate and npm Trusted Publishing preparation.
