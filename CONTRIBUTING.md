# Contributing

Thanks for considering a contribution. This guide focuses on adding support for a new AWS service via a preset.

## Development setup

- **Node.js** 18+
- **Docker** (for LocalStack; required for integration tests)

```bash
npm install
npm run build
npm test
```

Integration tests start real LocalStack containers. Run them with:

```bash
npm run test:integration
```

CI runs on every push and pull request to `main`, runs the full test suite (unit + integration) against LocalStack, so every preset is verified before merge.

## Code and testing standards

- Follow the project coding guidelines in **AGENTS.md** (naming, small functions, no explanatory comments, tests via public API).
- Tests must use the preset’s public interface only; no mocking of internal collaborators.
- Unit tests: assert options, validation errors, and that methods exist; assert “throws when not started” where relevant.
- Integration tests: optional; add a `*.integration.test.ts` that runs when `RUN_INTEGRATION=1` and exercises the preset against a live container.

## Adding a new preset

### 1. Copy the template

Copy `templates/preset-template.ts` to `src/presets/<service-name>.ts` (e.g. `kinesis.ts`). The template’s imports are written for `src/presets/`; leave them as-is after copying. Replace all placeholders (`MyService`, `my-service`, `MyServicePresetOptions`, etc.) with your service name.

### 2. Define options and validation

- Declare an options interface extending `AwsPresetOptions` (e.g. `MyServicePresetOptions`). Include service-specific options (resource names, seed data, etc.).
- Implement a validation function that calls `validateAwsPresetOptions(options)` and then validates your options (types, non-empty strings, array shapes). Use `asserts options is MyServicePresetOptions`.
- In the factory, call the validator before using options.

### 3. Implement the preset object

The preset must satisfy `LocalStackAwsPreset`:

| Member | Requirement |
|--------|-------------|
| `options` | Read-only resolved options (frozen object). |
| `start(shared?)` | If `shared` is provided, use it for connection; otherwise start a new `LocalstackContainer`. Create AWS resources and apply seed data. |
| `stop()` | Stop the container if the preset owns it; clear any stored connection/state. |
| `reset()` | Restore the environment to initial seed state (e.g. purge and re-send, or clear and re-put). Throw if not started. |
| `getConnectionUri()` | Return current connection URI; throw if not started. |
| `getContainerId()` | Return container ID; throw if preset does not own a container (e.g. started with shared). |
| `getCredentials()` | Return credentials (from shared or default test credentials). |
| `getConnectionConfig()` | Return `{ endpoint, credentials, region }` for building AWS SDK clients. |

Use the same LocalStack image and default credentials as existing presets (`localstack/localstack:3.0`, `accessKeyId: 'test'`, `secretAccessKey: 'test'`).

### 4. Export from the package

In `src/index.ts` add:

- `export { createMyServicePreset } from './presets/my-service.js';`
- `export type { MyServicePresetOptions, MyServicePreset, ... } from './presets/my-service.js';`

### 5. Add tests

- **Unit test:** `src/__tests__/<service>-preset.test.ts`. At least: preset has `start`, `stop`, `reset`, `getConnectionUri`, `getCredentials`, and `options`; options and validation (invalid options throw); `getConnectionUri()` and `reset()` throw when not started.
- **Integration test (optional):** `src/__tests__/<service>-preset.integration.test.ts` under `describeIntegration` (skipped unless `RUN_INTEGRATION=1`), using the preset against a real container and AWS SDK calls.

### 6. Shared preset

If the new preset should work with others in a single container, it must accept an optional `SharedConnection` in `start(shared?)`. When `shared` is passed, use `shared.getConnectionUri()`, `shared.getCredentials()`, and `shared.getRegion()` instead of starting your own container. Existing presets (e.g. `src/presets/sqs.ts`) show the pattern.

## Preset template

The file **`templates/preset-template.ts`** is a skeleton that implements the contract above with placeholder names. Copy it to `src/presets/<service>.ts`, replace placeholders, then implement the TODO sections (AWS client creation, resource creation, seed application, reset logic).

## Versioning and changelog

The project follows [Semantic Versioning](https://semver.org/): MAJOR for breaking changes, MINOR for new features (backward compatible), PATCH for fixes. When preparing a release, update **CHANGELOG.md**: move entries from `[Unreleased]` into a new `[X.Y.Z] - YYYY-MM-DD` section and bump the version in `package.json`.

## Pull requests

- Keep changes focused; prefer one preset or one concern per PR.
- Ensure `npm run build` and `npm test` pass. If you add integration tests, run `npm run test:integration` where possible.
- No need to open an issue for small additions (e.g. a new preset); for larger or breaking changes, opening an issue first can help align with maintainers.
