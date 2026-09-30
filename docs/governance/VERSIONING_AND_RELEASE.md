# Versioning and Governance Policy

## 1. Semantic Versioning
AryaFi Core adheres to Semantic Versioning (`MAJOR.MINOR.PATCH`):
- **MAJOR**: Incompatible contract upgrades, breaking state model changes, or removed choices.
- **MINOR**: Backward-compatible new templates, choices, and non-breaking contract enhancements.
- **PATCH**: Bug fixes, documentation updates, and performance optimizations.

## 2. Module Maturity Levels
Every module in the library is tagged with an explicit maturity status:
1. `Experimental`: Early stage, API may change without deprecation window.
2. `Beta`: Feature complete, undergoing multi-party integration and testing.
3. `Production Candidate`: Feature frozen, undergoing formal security review.
4. `Production Reviewed`: Independently audited, deployed to production Canton networks.

## 3. Release Process
1. Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md`, written for the people who use the release.
2. Set `version: X.Y.Z` in `daml.yaml` and `daml/test/daml.yaml`, and the data-dependency path in `daml/test/daml.yaml`.
3. Merge to `main`, then push the tag `vX.Y.Z`.

The release workflow (`.github/workflows/release.yml`) then runs the test suite, publishes the production DAR and its SHA-256 checksum, and uses the CHANGELOG section for `X.Y.Z` as the release notes. It stops before building if that section is missing.
