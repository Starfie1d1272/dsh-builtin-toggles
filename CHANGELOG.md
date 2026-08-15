# Changelog

## 0.3.1

### Correctness

- Fixed a false `duplicate_runtime_id` anomaly for legal Host and Agent
  Preset rows that share the same bare ID: duplicate detection is now scoped
  by composition instead of raw id.
- Added explicit composition-scope modeling (Host vs Agent Preset) so every
  row is evaluated against its own scope.
- Agent Preset rows are locked and ineligible server-side; they no longer
  borrow Host mutation or profile state.

### API & semantics

- Aligned anomalies-only filtering with compatibility semantics.
- Inspection API v1 stays backward compatible: the existing
  `profileOverride` / `profilePersistence` value domains are unchanged, and
  an additive `profileApplicability` field carries the Agent Preset
  not-applicable semantics for new consumers.
- Improved copy-diagnostics feedback with inline copied/failed status.

### Verification

- Added a real rc.6 Host + shipped `standard` Agent Preset smoke covering
  the cross-scope regression, `unverified` compatibility, and 9/9 eligible
  managed UI leaves.
- Added a new Inspector screenshot to the README.

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
