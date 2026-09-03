# CI workflows awaiting activation

The repaired pipelines are kept in `ci/workflows/` because the GitHub App used
for this branch does not have GitHub's **Workflows: read and write** permission.
GitHub rejects any push that changes `.github/workflows/`, even when ordinary
repository content can be pushed successfully.

The files are complete and YAML-validated:

- `ci/workflows/backend-ci.yml`
- `ci/workflows/frontend-ci.yml`

A maintainer with workflow permission should activate them after merging (or in
a follow-up branch):

```bash
git rm .github/workflows/django.yml
git mv ci/workflows/backend-ci.yml .github/workflows/backend-ci.yml
git mv ci/workflows/frontend-ci.yml .github/workflows/frontend-ci.yml
git commit -m "ci: activate backend and frontend pipelines"
git push
```

The obsolete active workflow on `master` targets Python 3.7–3.9, which cannot
run Django 5.2, and uses the wrong requirements path. It must be replaced rather
than retained.

## Pipeline coverage

Backend CI covers Python 3.11/3.12, SQLite and PostgreSQL 16, Django checks,
migration drift/rollback, OpenAPI validation, seed-command idempotency,
coverage, deployment checks and dependency auditing.

Frontend CI covers TypeScript, ESLint, the production Workbox build, a bounded
172-test Playwright cross-browser plan, and Lighthouse accessibility/SEO/
performance gates. Browser projects share one prepared backend to avoid paying
six times for installation and database seeding.

No production secret is embedded in either workflow. Database credentials and
Django keys in the jobs are ephemeral CI-only values.
