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
1. Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md`, written for the people who use the release, dated the day the tag is pushed.
2. Set `version: X.Y.Z` in `daml.yaml` and `daml/test/daml.yaml`, the data-dependency path in `daml/test/daml.yaml`, and the DAR file names in the docs' commands (`git grep 'aryafi-core-[a-z-]*[0-9]'`). Main carries the next version between releases, so a development build never has the same name and version as a released package.
3. Merge to `main`, then push the tag `vX.Y.Z`.

CI checks every pull request and every push to `main` with `dpm upgrade-check` against the latest release's DAR. Canton accepts a new `aryafi-core` package only as an upgrade of the versions already on a participant, so a MINOR or PATCH release must pass; a change that cannot pass needs a new package name (see §1).

When the tag is pushed, the release workflow (`.github/workflows/release.yml`) runs the test suite, publishes the production DAR and its SHA-256 checksum, and uses the CHANGELOG section for `X.Y.Z` as the release notes. It stops before building if that section is missing.
