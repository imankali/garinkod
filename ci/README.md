# CI workflows (pending installation)

These two files are the project's real CI pipelines. They live here rather than
in `.github/workflows/` for one reason only: **the GitHub App used by this
session does not hold the `workflows` permission**, so a push that adds or
edits anything under `.github/workflows/` is rejected outright:

```
! [remote rejected] refusing to allow a GitHub App to create or update
  workflow `.github/workflows/django.yml` without `workflows` permission
```

Keeping them here means the work is versioned and reviewable now, and becomes
active the moment someone with the right permission moves them.

## Installing them

```bash
git mv ci/workflows/backend-ci.yml  .github/workflows/django.yml
git mv ci/workflows/frontend-ci.yml .github/workflows/frontend.yml
git commit -m "ci: activate backend and frontend pipelines"
git push
```

A maintainer pushing from a normal account (or a token with the `workflow`
scope) can do this directly. Alternatively, grant the Arena GitHub App the
**Workflows: read and write** permission and the files can be committed to
their proper location in a future session.

## Why the existing workflow must be replaced, not kept

`.github/workflows/django.yml` on `master` runs the test suite against
**Python 3.7, 3.8 and 3.9**. All three are end of life, and none of them can
import Django 5.2 — which is what `requirements.txt` pins. That workflow cannot
have passed since the framework upgrade; it either fails at install time or
never ran. `backend-ci.yml` replaces it with Python 3.11/3.12.

It also points `pip install -r requirements.txt` at the repository root, where
no such file exists (it is in `garinkood/`).

## What each pipeline does

### `backend-ci.yml`

| Job | Purpose |
|---|---|
| `test` | Runs the 96-test suite on Python 3.11 and 3.12, against **both** SQLite and a real PostgreSQL 16 service. Production runs Postgres, where `select_for_update`, partial unique indexes and check constraints behave differently from SQLite — a suite that only passes on SQLite proves less than it appears to. |
| | Verifies `makemigrations --check` (models and migrations agree), a full `migrate → rollback to 0006 → migrate` cycle, and that every seed command is idempotent when run twice. |
| | Uploads a coverage report as an artifact. |
| `security` | `manage.py check --deploy --fail-level WARNING` with production-like settings, plus `pip-audit` against known CVEs. |

### `frontend-ci.yml`

| Job | Purpose |
|---|---|
| `quality` | `tsc --noEmit`, ESLint with `--max-warnings 0`, and a production build. |
| `e2e` | Boots a real Django API with seeded data, then runs Playwright across six projects: Chromium, Firefox, **WebKit (Safari)**, Pixel, iPhone and iPad. Rate limits are raised via environment variables so the browsers do not trip the throttles that protect production. Reports, traces and videos are uploaded as artifacts. |
| `lighthouse` | Lighthouse CI over four pages. Accessibility is a hard gate at ≥ 0.9; performance, best practices, SEO and Core Web Vitals are warnings so a slow CI runner cannot block a merge on timing noise. |

## Secrets

Neither pipeline needs a secret. The PostgreSQL credentials are for an
ephemeral service container, and `SECRET_KEY` in the deploy check is a
throwaway value used solely to exercise the check itself — it is never a
production key.
