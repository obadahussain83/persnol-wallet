# Personal Wallet

Offline-first personal finance app for web, iOS and Android. Expo + React Native + PowerSync (local SQLite) + Supabase (Postgres, Auth, RLS).

**Status:** Phase 0 (technical validation) complete. See [docs/DEVELOPMENT_PROGRESS.md](docs/DEVELOPMENT_PROGRESS.md).

## Run

Keep the project on a short path outside OneDrive/Dropbox (e.g. `C:/dev/personal-wallet`): native Android builds exceed Windows path limits and sync tools disturb builds.

```bash
npm install            # also copies PowerSync web workers into public/@powersync
npm test               # money, ledger SQL, migration + RLS tests (no Docker needed)
npm run web            # web app at http://localhost:8081
```

Android (local Gradle builds fail on Windows: generated C++ paths exceed 260 chars, see DEVELOPMENT_PROGRESS) — build in the cloud:

```bash
npx eas-cli@latest build --profile development --platform android
```

Install the APK on a device/emulator, start Metro with `npx expo start`, and on the emulator run `adb reverse tcp:8081 tcp:8081` and open the app pointed at `http://localhost:8081` (the `10.0.2.2` route corrupted the bundle download on this machine).

iOS: `npx eas-cli@latest build --profile development --platform ios` (needs an Apple developer account).

Without `.env` the app runs **local-only** (fully usable, nothing syncs). To enable sync, copy `.env.example` to `.env` and follow "Cloud setup" in [docs/SYNC_ENGINE.md](docs/SYNC_ENGINE.md).

## Docs

| Doc | What |
|---|---|
| [PROJECT_PLAN](docs/PROJECT_PLAN.md) | Phases and scope |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Stack, diagram, decisions, dependency assessment, cost, risks |
| [DATABASE_SCHEMA](docs/DATABASE_SCHEMA.md) | Tables, money model, ledger rules |
| [SYNC_ENGINE](docs/SYNC_ENGINE.md) | Offline writes, upload queue, conflicts, cloud setup |
| [SECURITY](docs/SECURITY.md) | RLS, secrets, local data |
| [TESTING](docs/TESTING.md) | Test strategy and what is covered |
| [DEVELOPMENT_PROGRESS](docs/DEVELOPMENT_PROGRESS.md) | Checklist, known limitations |
| [CHANGELOG](docs/CHANGELOG.md) | Changes |
| [COMPETITOR_ANALYSIS](docs/COMPETITOR_ANALYSIS.md) | Market comparison and resulting priorities |
