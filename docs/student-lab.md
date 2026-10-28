# Lab — MERN CI/CD with GitHub Actions

Implement `.github/workflows/ci-cd.yml` in your own fork. Use the calculator's
single-job structure to run checks, build both images, and publish to GHCR on
`main`. Verify the published images locally. No deployment is required.

## 1. Implement the workflow

Complete the README's local checks. Work directly on **your own fork's `main`**
for this lab; no feature branch or PR is required to complete it.

Create `.github/workflows/ci-cd.yml` with this starting structure:

```yaml
name: MERN checks and image delivery

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  packages: write

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Get the project files
        uses: actions/checkout@v7

      # Add the supplied steps below here, in order.
```

This extends the calculator's push-only trigger. The workflow name appears in
Actions; `ci` is the job identifier. Checkout makes the repository files available
on the Ubuntu runner. Add each supplied step below at the same indentation as
`- name: Get the project files` (six spaces). `run` and `uses` belong two spaces
inside their step. Do not add another `jobs`, `steps`, or `permissions` block.

### When the workflow runs

| Event | Checks and image builds | GHCR publication |
| --- | --- | --- |
| Push a commit to your `main` | Run | Run if all prior checks/builds pass |
| Open a PR targeting your `main` | Run | Skipped |
| Push more commits to that open PR's source branch (`synchronize`) | Run | Skipped |
| Reopen a PR targeting your `main` | Run | Skipped |
| Push to another branch without an open PR targeting `main` | Not triggered | Not triggered |
| Merge a PR into `main` | The resulting push runs the workflow | Run if successful |

For `pull_request`, `branches: [main]` filters the **target** branch, not the source
branch. PR checks validate the proposed merge before acceptance; checkout normally
uses GitHub's temporary merge commit. The PR's source can be a branch or fork.
The PR must target **your repository**, not the instructor's repository.

You will use the push-to-main path in this individual lab. Keep the PR trigger in
the workflow so future proposed changes can be checked before merging. A PR run
must never publish images; the main-only conditions supplied below enforce that.
Use `pull_request`, not `pull_request_target`, for these code checks.

Node runs inside the images, so omit `setup-node`. GHCR publishing replaces the
calculator's artifact upload. The completed workflow is yours to assemble.

The scaffold's `contents: read` permits checkout; `packages: write` allows the
automatic `GITHUB_TOKEN` to publish packages. 

### Tests and checks — after checkout

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

Compose supplies test MongoDB and test settings; CI needs no local `.env`.
Keep failure handling unchanged: a failed check must block subsequent builds
and publication.

### Image names

```yaml
- name: Prepare image names
  shell: bash
  run: |
    repository="${GITHUB_REPOSITORY,,}"
    echo "BACKEND_IMAGE=ghcr.io/${repository}-backend" >> "$GITHUB_ENV"
    echo "FRONTEND_IMAGE=ghcr.io/${repository}-frontend" >> "$GITHUB_ENV"
```

`GITHUB_REPOSITORY` supplies `owner/repo`; `,,` lowercases it for valid image
names. Writing to `GITHUB_ENV` makes these values available to later steps.

### Build both images

```yaml
- name: Build backend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$BACKEND_IMAGE:latest" -t "$BACKEND_IMAGE:sha-$GITHUB_SHA" ./backend

- name: Build frontend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$FRONTEND_IMAGE:latest" -t "$FRONTEND_IMAGE:sha-$GITHUB_SHA" ./frontend
```

Each image gets `latest` and `sha-<commit>` tags. The label links the package to
your repository. These Dockerfiles package the development app; tests run in
the preceding steps.

### GHCR login and publication

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

The condition requires both a `push` event and the `main` branch. PR runs test
and build but skip login and publication. The token is supplied by GitHub.
Major action tags match the calculator
example's style; maintained release pipelines should pin reviewed commit SHAs.

### Cleanup — last step

```yaml
- name: Clean up the test environment
  if: always()
  run: docker compose -f compose.test.yaml down --volumes
```

`always()` removes the test stack even after failure, without changing the result.

## 2. Verify the workflow

1. Commit the assembled workflow directly to your fork's `main` and push. Inspect
   the Actions run: checks, image builds, GHCR login, and publication should pass.
2. Break one supplied test expectation, commit on `main`, and push. Confirm the
   failed test skips subsequent build/login/publish steps, while cleanup still
   runs. Images from the earlier successful run remain in GHCR; the failing
   commit should not have new published images.
3. Restore the expectation, commit, and push to `main`. Confirm all checks pass
   and images with this successful run's commit tag are published.
4. Find both packages and make them public for unauthenticated pulls below.

Optional PR verification (not required for submission): after the workflow exists
on main, open a PR from a temporary branch into your fork's main. Confirm checks
and builds run but login/publication are skipped. Push another commit to the PR
branch to observe `synchronize`. Closing without merging does not publish;
merging produces a main-branch push and a new publishing run.

## 3. Run the published images

Stop the local stack with `docker compose down`. Update root `.env`, preserving
your session secret:

```dotenv
BACKEND_IMAGE=ghcr.io/YOUR-LOWERCASE-OWNER/YOUR-LOWERCASE-REPO-backend
FRONTEND_IMAGE=ghcr.io/YOUR-LOWERCASE-OWNER/YOUR-LOWERCASE-REPO-frontend
IMAGE_TAG=sha-FULL_COMMIT_SHA_FROM_SUCCESSFUL_MAIN_RUN
```

Replace the placeholders. Image names exclude tags; use the successful **main
run's SHA**, which may differ from the branch SHA after merging.

```sh
docker compose -f compose.published.yaml pull
docker compose -f compose.published.yaml up -d --wait
docker compose -f compose.published.yaml ps
```

Verify authentication and note CRUD at http://localhost:3000, then restart and
check persistence. This stack has its own database volume. Use the downloaded
images without rebuilding locally.

```sh
docker compose -f compose.published.yaml down
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| GHCR push denied | Job permissions, namespace, package Actions access |
| Pull denied | Package visibility and image name/tag |
| Invalid image reference | Lowercase names; no tag in the image variable |
| App not ready | Frontend compilation and service health/logs |
| Tests use old code | Rebuild test images after edits |

## Submit

- Repository/workflow link and failed-then-fixed test runs.
- Successful main publishing run and links to both GHCR packages.
- Shared commit tag and evidence the downloaded app works.

Explain the main-only condition, `GITHUB_TOKEN`, image tags, and how the pipeline
blocks publication on failure. Distinguish image delivery from deployment.

## References

- [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [Working with GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Workflow events and pull requests](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)
