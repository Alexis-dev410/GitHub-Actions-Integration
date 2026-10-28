# Lab — Build the MERN pipeline incrementally

Work individually on your own fork's **main**. Implement
`.github/workflows/ci-cd.yml` using the calculator's single-job structure and the
supplied Docker/GHCR code. Start with the README's local checks.

**Build one checkpoint at a time. Push and inspect its Actions run before adding
the next checkpoint. Do not assemble the entire workflow first.** Each new run
repeats all steps added so far. If a checkpoint fails unexpectedly, fix it and
push again before continuing.

| Run | What you add or change | Expected result |
| --- | --- | --- |
| 1 | Workflow scaffold and checkout | Green; repository checked out |
| 2 | Tests, lint, type checking, cleanup | Green; 5 backend and 2 frontend tests pass |
| 3 | Image names and Docker builds | Green; both images built, nothing published |
| 4 | GHCR permission, login, publication | Green; two packages published |
| 5 | Deliberately break a test | Red; publication skipped, cleanup still runs |
| 6 | Restore the test | Green; a new commit-tagged version published |

## Checkpoint 1 — Get a workflow running

Create `.github/workflows/ci-cd.yml` with this scaffold only:

```yaml
name: MERN checks and image delivery

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Get the project files
        uses: actions/checkout@v7

      # Run 1: keep only checkout.
      # At Checkpoint 2, add the test and cleanup steps here.
```

Keep a descriptive workflow name and the checkout step. The `push` trigger is
restricted to `main`; `ci` is the single Ubuntu job. Node runs inside the Docker
images later, so no `setup-node` step is needed.

**Run 1:** commit with a message such as `ci: add workflow scaffold` and push to
main. Open **Actions → MERN checks and image delivery → the latest run → ci**.
Confirm checkout passes. At this point no tests, builds, or publishing should
appear. Save the run link, then continue.

For every later checkpoint, add supplied steps at the same indentation as
`- name: Get the project files` (six spaces). Indent `run`, `uses`, and `if` two
spaces inside their step. Keep one workflow, one job, and one `steps` list.

## Checkpoint 2 — Automate the checks

Add these steps after checkout:

```yaml
- name: Build images for the supplied tests
  run: docker compose -f compose.test.yaml build

- name: Run backend API tests
  run: docker compose -f compose.test.yaml run --rm backend-test

- name: Run frontend tests
  run: docker compose -f compose.test.yaml run --rm frontend-test

- name: Check backend code style
  run: docker compose -f compose.test.yaml run --rm backend-test npm run lint

- name: Check backend TypeScript
  run: docker compose -f compose.test.yaml run --rm backend-test npm run typecheck
```

Then add cleanup as the **last step**:

```yaml
- name: Clean up the test environment
  if: always()
  run: docker compose -f compose.test.yaml down --volumes
```

Compose supplies an isolated test MongoDB and test settings; CI needs no local
`.env`. `always()` runs cleanup even if a check fails. Do not use
`continue-on-error` or otherwise ignore failed checks.

**Run 2:** commit (`ci: run supplied checks`) and push. Inspect each step:

- Backend: `5 passed`; frontend: `2 passed`.
- Lint and type checking: exit successfully, with no reported problems.
- Cleanup: completes and removes the test environment.

Stop here until the run is green. Keep cleanup last as you extend the workflow.
There should still be no GHCR login or publication steps.

## Checkpoint 3 — Build and tag the images

Insert the following naming and build steps **after type checking and before
cleanup**. Keep all existing steps.

```yaml
- name: Prepare image names
  shell: bash
  run: |
    repository="${GITHUB_REPOSITORY,,}"
    echo "BACKEND_IMAGE=ghcr.io/${repository}-backend" >> "$GITHUB_ENV"
    echo "FRONTEND_IMAGE=ghcr.io/${repository}-frontend" >> "$GITHUB_ENV"
```

`GITHUB_REPOSITORY` supplies `owner/repo`; `,,` lowercases it. `GITHUB_ENV` makes
the image names available to later steps.

```yaml
- name: Build backend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$BACKEND_IMAGE:latest" -t "$BACKEND_IMAGE:sha-$GITHUB_SHA" ./backend

- name: Build frontend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$FRONTEND_IMAGE:latest" -t "$FRONTEND_IMAGE:sha-$GITHUB_SHA" ./frontend
```

Each image gets `latest` and `sha-<commit>` tags. The source label links it to your
repository. These Dockerfiles package the development app; they do not run tests.

**Run 3:** commit (`ci: build application images`) and push. Confirm the earlier
checks still pass and both Docker build steps complete. Nothing is published yet:
the images exist only on this run's runner. Do not look for new GHCR packages at
this checkpoint. Continue only after this run is green.

## Checkpoint 4 — Publish to GHCR

Add `packages: write` to the existing top-level permissions block so it becomes:

```yaml
permissions:
  contents: read
  packages: write
```

Insert these steps **after the frontend image build and before cleanup**:

```yaml
- name: Log in to GHCR
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  uses: docker/login-action@v4
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- name: Publish both images
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: |
    docker push "$BACKEND_IMAGE:sha-$GITHUB_SHA"
    docker push "$FRONTEND_IMAGE:sha-$GITHUB_SHA"
    docker push "$BACKEND_IMAGE:latest"
    docker push "$FRONTEND_IMAGE:latest"
```

GitHub supplies `GITHUB_TOKEN`; `packages: write` allows it to publish packages.
The condition restricts login/publication to pushes on main. The major action tag
matches the calculator's style; maintained pipelines should pin reviewed SHAs.

The final step order is now:

```text
Checkout → build test images → backend tests → frontend tests → lint → typecheck
→ prepare names → build backend → build frontend → GHCR login → push → cleanup
```

**Run 4:** commit (`ci: publish images to GHCR`) and push. Confirm all earlier
checks/builds pass, then inspect the login and push steps. In your profile's
**Packages**, find both `<repo>-backend` and `<repo>-frontend` with `latest` and
`sha-<this run's full commit SHA>` tags. Make both packages public for the local
pull later. Save the run and package links. Resolve any publishing errors before
continuing.

## Checkpoint 5 — Prove a failure blocks delivery

In `backend/tests/api.test.ts`, change the health test's expected body from
`{ status: "ok" }` to `{ status: "broken" }`. Leave the application unchanged.

**Run 5:** commit (`test: demonstrate blocked delivery`) and push. This run should
be red. Confirm:

- Backend tests fail on that expectation.
- Later normal steps, including image builds, login, and publishing, are skipped.
- Cleanup still runs.
- GHCR retains the previous images; neither package has a tag for this failing
  commit. Existing packages do not disappear after a failed run.

Save this failed run link. Then restore the expectation to `{ status: "ok" }`.

**Run 6:** commit (`test: restore passing expectation`) and push. Confirm all
checks pass and both images are published with the new successful commit tag.
Use **Run 6's SHA** for the next checkpoint.

## Checkpoint 6 — Run the delivered images

Stop the local source-built stack with `docker compose down`. Update root `.env`,
preserving your session secret:

```dotenv
BACKEND_IMAGE=ghcr.io/YOUR-LOWERCASE-OWNER/YOUR-LOWERCASE-REPO-backend
FRONTEND_IMAGE=ghcr.io/YOUR-LOWERCASE-OWNER/YOUR-LOWERCASE-REPO-frontend
IMAGE_TAG=sha-FULL_COMMIT_SHA_FROM_RUN_6
```

Replace the placeholders; image names exclude tags. Run:

```sh
docker compose -f compose.published.yaml pull
docker compose -f compose.published.yaml up -d --wait
docker compose -f compose.published.yaml ps
```

Verify authentication and note CRUD at http://localhost:3000. Restart and check
persistence. This stack has its own database volume. Use downloaded images
without rebuilding locally. This checkpoint runs locally and needs no new
workflow run. Keep `.env` out of Git.

```sh
docker compose -f compose.published.yaml down
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No workflow run | File path, YAML syntax, and push to your fork's main |
| Checkpoint fails | Inspect the first failed step before adding more steps |
| GHCR push denied | Permission, namespace, package Actions access |
| Pull denied | Package visibility and exact image name/tag |
| Invalid image reference | Lowercase names; no tag in the image variable |
| App not ready | Frontend compilation and service health/logs |
| Tests use old code | Rebuild test images after edits |

## Submit

- Repository/workflow link and run links labelled Run 1 through Run 6 (plus any repair runs).
- Links to both GHCR packages and the shared commit tag from Run 6.
- Evidence the downloaded app works.

Explain the main-only condition, `GITHUB_TOKEN`, image tags, and why Run 5 blocked
publication. Distinguish image delivery from deployment; online deployment is not
part of this lab.

## Other trigger events

A workflow can listen to multiple events, e.g. `on: [push, pull_request]`.
Keep this lab's push-to-main trigger; no PR activity is required.

## References

- [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [Working with GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
