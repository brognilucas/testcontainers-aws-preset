# Changelog

This project follows [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**. We will not make breaking changes without a new major version; new features and fixes are added in minor/patch releases.

## [Unreleased]

## [0.1.0] - 2026-02-24

Initial release.

### Added

- Presets for AWS services (LocalStack): SQS, DynamoDB, S3-SQS, SNS-SQS, EventBridge-SQS, Secrets Manager.
- Shared preset to run multiple presets against a single LocalStack container.
- Seed data support: `seedMessages` (SQS, SNS-SQS), `seedData` (DynamoDB), `seedObjects` (S3-SQS), `seedEvents` (EventBridge-SQS), `seedSecrets` (Secrets Manager).
- `reset()` on each preset to restore the environment to initial seed state without restarting the container.
- `getConnectionConfig()` for building AWS SDK clients (endpoint, credentials, region).
- Optional Jest `globalSetup`/`globalTeardown` for shared container lifecycle.
- README with getting started and Todo API example (DynamoDB + SQS).
- CONTRIBUTING guide and preset template for adding new AWS services.
- CHANGELOG and semantic versioning (SemVer); versioning documented in README and CONTRIBUTING.
- TypeScript types for all preset options; configuration validation at preset creation.

[Unreleased]: https://github.com/your-org/testcontainers-aws-preset/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/testcontainers-aws-preset/releases/tag/v0.1.0
