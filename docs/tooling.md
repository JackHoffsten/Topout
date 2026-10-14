# Formatting and tooling checks

Repository-wide settings live at the root; settings for a component live beside
that component. Prettier settings are in the root `package.json`, CSharpier settings
and exclusions are in `server/`, and Python tooling settings and dependencies are
in `deploy/`. Git, Docker, EditorConfig, shared TypeScript settings, and Compose
files stay at the root because they apply across the repository.

Each browser test suite keeps its Playwright configuration beside its tests:
`e2e/playwright.config.ts` for API-backed tests and
`browser-tests/playwright.config.ts` for keyboard and layout tests. Run them from
the root with `npm run test:e2e` and `npm run test:keyboard` respectively. Vitest
settings live in `packages/shared/vitest.config.mts`, beside the package that uses
them. `npm run test:unit` runs that package's tests; `npm test` runs both shared and
app tests. The root `tsconfig.json` checks repository tooling, while
`tsconfig.base.json` shares compiler settings with the shared package.

Prettier formats TypeScript, JavaScript, JSON, YAML, and Markdown. CSharpier formats
maintained C# source and tests. Ruff formats Python deployment scripts and tests.
Generated outputs, native build folders, and EF migrations remain under their
generators' control.

```powershell
npm run format
npm run format:check
dotnet tool restore
npm run format:backend
npm run format:backend:check
```

Set up Python tooling in a local virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r deploy/requirements-dev.txt
npm run format:python
npm run format:python:check
python -m unittest discover -s deploy/tests
```

On Linux, activate with `source .venv/bin/activate`. Python tooling is pinned in
`deploy/requirements-dev.txt`. CI creates its own virtual environment, checks Python
formatting, runs deployment tests, and checks shell syntax with
`sh -n deploy/postgres-init.sh`. Deployment scripts retain their standalone layout
so installing the scripts on a server does not require additional local modules.

The Debian Jenkins builder needs Python with `venv` and pip support (typically the
`python3-venv` package), plus access to the Python package index. Backup tests that
need root privileges, PostgreSQL tools, or GnuPG skip when those prerequisites are
absent.

Source uses the existing two-space indentation, with four spaces for C# and Python.
Deployment files and container configuration use LF line endings as specified by
`.gitattributes` and `.editorconfig`.
