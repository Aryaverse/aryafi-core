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
