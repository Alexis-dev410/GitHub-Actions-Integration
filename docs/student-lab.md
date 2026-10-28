# Lab — Build the MERN pipeline incrementally

Work individually on your own fork's **main**. Implement
`.github/workflows/ci-cd.yml` using the calculator's single-job structure and the
supplied Docker/GHCR code. Start with the README's local checks.

## Before Run 1 — Give your instructor access

As soon as your fork is ready, open **Settings → Collaborators → Add people**
and invite **`chakirouAlabani`**. Send me the repository link on teams so the
invitation can be accepted before grading.

Give me **Write access** as a repository collaborator. 

## How to work through the checkpoints

For each supplied workflow block, copy the code into the stated location. Keep
its variable names and expressions unchanged unless a step explicitly asks you
to edit them. GitHub fills in your repository, account, and commit automatically.
Only the local `.env` example at Checkpoint 6 contains placeholders to replace.
The workflow runs on GitHub after a push; local commands are identified separately.

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

Create `.github/workflows/ci-cd.yml` and copy this scaffold unchanged. Do not add
any later checkpoint code yet:

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

No values need replacing in this block. You may change the workflow's display
name, but keep the trigger, job, and checkout step. GitHub starts an Ubuntu
computer for the job and checkout downloads your code onto it. Later steps run
Node inside Docker, so you do not need to add `setup-node`.

**Run 1:** commit with a message such as `ci: add workflow scaffold` and push to
main. Open **Actions → MERN checks and image delivery → the latest run → ci**.
Confirm checkout passes. At this point no tests, builds, or publishing should
appear. Save the run link, then continue.

For every later checkpoint, add supplied steps at the same indentation as
`- name: Get the project files` (six spaces). Indent `run`, `uses`, and `if` two
spaces inside their step. Keep one workflow, one job, and one `steps` list.

## Checkpoint 2 — Automate the checks

Copy these steps unchanged after checkout. You do not need to write new tests
or configure a database:

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

Copy this cleanup step unchanged as the **last step**:

```yaml
- name: Clean up the test environment
  if: always()
  run: docker compose -f compose.test.yaml down --volumes
```

The supplied Compose file starts a separate test database and provides its
settings automatically. Do not upload your local `.env` or add database secrets
to GitHub. The cleanup step removes that test environment, including after a
failed check. Keep `if: always()` as written and do not add `continue-on-error`.

**Run 2:** commit (`ci: run supplied checks`) and push. Inspect each step:

- Backend: `5 passed`; frontend: `2 passed`.
- Lint and type checking: exit successfully, with no reported problems.
- Cleanup: completes and removes the test environment.

Stop here until the run is green. Keep cleanup last as you extend the workflow.
There should still be no GHCR login or publication steps.

## Checkpoint 3 — Build and tag the images

Insert the following naming and build steps **after type checking and before
cleanup**. Copy both blocks unchanged; keep all existing steps.

```yaml
- name: Prepare image names
  shell: bash
  run: |
    repository="${GITHUB_REPOSITORY,,}"
    echo "BACKEND_IMAGE=ghcr.io/${repository}-backend" >> "$GITHUB_ENV"
    echo "FRONTEND_IMAGE=ghcr.io/${repository}-frontend" >> "$GITHUB_ENV"
```

This step creates your two GHCR image names automatically from your GitHub
account and repository name. For example, `Alex/mern-notes` becomes
`ghcr.io/alex/mern-notes-backend` and `ghcr.io/alex/mern-notes-frontend`.
It converts the names to lowercase and saves them for the build and publishing
steps. **Do not type your username into this code or replace any variables.**

```yaml
- name: Build backend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$BACKEND_IMAGE:latest" -t "$BACKEND_IMAGE:sha-$GITHUB_SHA" ./backend

- name: Build frontend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$FRONTEND_IMAGE:latest" -t "$FRONTEND_IMAGE:sha-$GITHUB_SHA" ./frontend
```

The build commands use the names created above. GitHub also supplies the commit
identifier, so both images automatically receive a `sha-...` version tag and a
`latest` tag. The label records which repository produced the image. You do not
need to enter a commit value or edit the commands. The existing Dockerfiles
package the app; the earlier workflow steps run its tests.

**Run 3:** commit (`ci: build application images`) and push. Confirm the earlier
checks still pass and both Docker build steps complete. Nothing is published yet:
the images exist only on this run's runner. Do not look for new GHCR packages at
this checkpoint. Continue only after this run is green.

## Checkpoint 4 — Publish to GHCR

Edit the existing top-level permissions block to match the code below. Add only
`packages: write`; do not create a second permissions block:

```yaml
permissions:
  contents: read
  packages: write
```

Copy these steps unchanged **after the frontend image build and before cleanup**:

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

GitHub automatically supplies the login account and a temporary token for this
run. **Leave `github.actor` and `secrets.GITHUB_TOKEN` exactly as written**; do not
replace them with your username or password, and do not create a token secret.
The permission you added allows the upload. The `if` line allows it only on a
push to main. The push commands upload both images using their saved names and
automatically generated tags. No additional values need replacing here.

The final step order is now:

```text
Checkout → build test images → backend tests → frontend tests → lint → typecheck
→ prepare names → build backend → build frontend → GHCR login → push → cleanup
```

**Run 4:** commit (`ci: publish images to GHCR`) and push. Confirm all earlier
checks/builds pass, then inspect the login and push steps. In your profile's
**Packages**, find both `<repo>-backend` and `<repo>-frontend` with `latest` and
`sha-...` tags matching this run's commit. These packages are your stored backend
and frontend images. In each package's settings, change visibility to public so
you can download it locally without logging in. This is a manual action you must
perform for both packages. Save the run and package links. Resolve publishing
errors before continuing.

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
For the next checkpoint, copy the full `sha-...` tag from either package version
published by this successful run. Both packages should have that same tag.

## Checkpoint 6 — Run the delivered images

On your laptop, stop the source-built stack with `docker compose down`. Edit
root `.env`, preserving your session secret. **Here you must replace the
placeholders** with your own published image names and version tag:

```dotenv
BACKEND_IMAGE=ghcr.io/YOUR-LOWERCASE-OWNER/YOUR-LOWERCASE-REPO-backend
FRONTEND_IMAGE=ghcr.io/YOUR-LOWERCASE-OWNER/YOUR-LOWERCASE-REPO-frontend
IMAGE_TAG=sha-FULL_COMMIT_SHA_FROM_RUN_6
```

Copy each full image name from its GHCR package page into the corresponding
image variable, without a colon or tag. Set `IMAGE_TAG` to the complete
`sha-...` tag copied after Run 6. Do not leave any uppercase placeholder text
from the example. These are local settings; do not edit your workflow for this.

Run these commands locally:

```sh
docker compose -f compose.published.yaml pull
docker compose -f compose.published.yaml up -d --wait
docker compose -f compose.published.yaml ps
```

Verify authentication and note CRUD at http://localhost:3000. Restart and check
persistence. This configuration stores app data separately, so accounts from
your earlier source-built stack will not appear; create a test account here.
Use the downloaded images without rebuilding locally. You do not need to commit
or push for this checkpoint. Keep `.env` out of Git.

**The final lab step is a live demonstration to your instructor of the published
images running on your own laptop. Show it before stopping the stack.** Demonstrate authentication, note creation/editing/deletion, and persistence
after restarting. Show the running containers and their image tags using:

```sh
docker compose -f compose.published.yaml ps
docker compose -f compose.published.yaml images
```

Your instructor will compare the images with Run 6 and the GHCR packages. No
recording is required; this is a live demonstration. Then stop the stack:

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

- Repository & packages link.
- Live local demonstration at Checkpoint 6 (Call me when you are done).


## Other trigger events

A workflow can listen to multiple events, e.g. `on: [push, pull_request]`.
Keep this lab's push-to-main trigger; no PR activity is required.

## References

- [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [Working with GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
