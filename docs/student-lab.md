# Student lab: from the calculator workflow to MERN image delivery

## Goal and scope

Work individually in your own fork. Implement `.github/workflows/ci-cd.yml` so a
push runs the supplied tests, builds two development images, and publishes them
to GitHub Container Registry (GHCR) only on `main`. Then pull and run those images
on your laptop. We are not deploying to an online server.

The app still uses CRA `npm start`, backend Nodemon, and MongoDB. Dockerfiles,
Compose, tests, and the unfamiliar Docker/GHCR code below are supplied. Your task
is to assemble and explain a basic workflow, run it, diagnose failures, and verify
its output. There is no completed workflow in `.github/workflows/`.

## 1. Verify the starter

Follow the README to start the app and run its tests locally. Check signup/login
and note creation. Create a branch for your workflow:

```sh
git switch -c ci/github-actions
```

## 2. Reuse what you know from the calculator

The calculator workflow has a name, a push trigger, read permission, one Ubuntu
job, a checkout step, test/build steps, and an artifact upload step.

| Calculator | MERN |
| --- | --- |
| `name`, `on: [push]`, `jobs`, `runs-on`, `steps` | Same basic workflow structure |
| `actions/checkout@v7` | Same checkout step |
| `actions/setup-node` | Not needed here: Node is already inside the Docker images |
| `npm test` | Supplied Compose steps run frontend/backend tests |
| `npm run build` | Supplied Docker commands package both development apps |
| `actions/upload-artifact` | Supplied GHCR login/push steps deliver container images |

Create your workflow file. Write a descriptive name, use `on: [push]`, create one
job on `ubuntu-latest`, and write the checkout step as in the calculator example.
Use the permission block supplied below instead of the calculator's read-only
block. Add the supplied steps under your job's `steps`, at the same indentation
level as checkout. Keep them in the order shown. Write your own descriptive step
names if you prefer.

You are not expected to invent the Bash expressions, registry authentication,
container networking, or Docker commands. Copy the supplied blocks and explain
their role. No matrix, multiple jobs, Buildx setup, or deployment job is required.

## 3. Supplied permission block

Place this at the workflow's top level, alongside `name`, `on`, and `jobs`:

```yaml
permissions:
  contents: read
  packages: write
```

`contents: read` lets checkout read code. `packages: write` lets the workflow's
automatically supplied `GITHUB_TOKEN` publish images to GHCR. Do not create a
personal token or put your GitHub password in the file.

## 4. Supplied test and check steps

Place these after your checkout step:

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

The runner has Docker. `compose.test.yaml` starts an isolated MongoDB and waits
until it is healthy before backend tests run. Compose replaces the app's normal
start command with its test command. Test credentials are supplied already; CI
does not need your local `.env` file or real database credentials.

GitHub stops normal subsequent steps when one fails, just as in the calculator
exercise. Do not add `continue-on-error` or hide errors.

## 5. Supplied image naming step

Place this after the checks:

```yaml
- name: Prepare image names
  shell: bash
  run: |
    repository="${GITHUB_REPOSITORY,,}"
    echo "BACKEND_IMAGE=ghcr.io/${repository}-backend" >> "$GITHUB_ENV"
    echo "FRONTEND_IMAGE=ghcr.io/${repository}-frontend" >> "$GITHUB_ENV"
```

GitHub supplies `GITHUB_REPOSITORY` as `owner/repository`. Bash `,,` converts it to
lowercase because image repository names must be lowercase. `$GITHUB_ENV` makes
these values available to later steps. Use your own fork's namespace, not the
instructor's; this snippet does that automatically.

For a repository named `alex/mern-notes`, the result is:

```text
ghcr.io/alex/mern-notes-backend
ghcr.io/alex/mern-notes-frontend
```

## 6. Supplied image build steps

```yaml
- name: Build backend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$BACKEND_IMAGE:latest" -t "$BACKEND_IMAGE:sha-$GITHUB_SHA" ./backend

- name: Build frontend image
  run: |
    docker build --label "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" -t "$FRONTEND_IMAGE:latest" -t "$FRONTEND_IMAGE:sha-$GITHUB_SHA" ./frontend
```

Each command uses its app's directory as the build context. `-t` names the image.
Both tags refer to the same built image: `latest` is convenient, while
`sha-<full commit SHA>` identifies which source commit produced it. The source
label associates the package with this repository. A tag can move; a digest is
an exact content identifier.

These builds install dependencies and copy the development application. They do
not create a production release or run tests. The checks above run first.

## 7. Supplied GHCR login and push steps

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

`uses` runs an existing action; `run` executes commands. The expression after
`if` allows login/publishing only on a push to `main`. Feature-branch pushes still
test and build. Earlier failures skip publication. `GITHUB_TOKEN` is automatic;
`github.actor` is the account that triggered the run. `docker push` uploads the
images to GHCR. GHCR stores images; it does not start the app.

The major action tag is used for readability, matching the calculator example.
For maintained release pipelines, pin actions to reviewed commit SHAs.

## 8. Supplied cleanup step

Place this last, after the publish step:

```yaml
- name: Clean up the test environment
  if: always()
  run: docker compose -f compose.test.yaml down --volumes
```

`always()` runs cleanup even after a failed test. It removes only the isolated
test stack. It does not make a failed workflow pass.

## 9. Run, inspect, and merge

1. Commit and push your branch. Inspect the Actions run. Tests, checks, and image
   builds should pass. Login/publish should be skipped because this is not main.
2. Change an expected value in a supplied test to make it fail. Commit and push.
   Confirm the run fails and later build/publish steps are skipped. Restore the
   expectation, commit, and push; confirm the run passes again.
3. Open a PR into **your own fork's main**, selecting your fork as the base
   repository. Review your changes yourself; this is an individual lab.
4. Merge the PR. The push to main now runs checks, builds, and publishes images.
5. Open your GitHub profile's Packages tab. Find both packages and change each
   package's visibility to public so your laptop can pull without logging in.

With `on: [push]`, pushing branch commits triggers checks; you do not need an
additional pull-request trigger for this basic lab. Opening a PR alone does not
create a separate run. Branch push checks are associated with that commit.

## 10. Pull and run the workflow's images locally

Stop the source-built app first to free port 3000:

```sh
docker compose down
```

Update your root `.env`, keeping your own session secret. For example:

```dotenv
SESSION_SECRET=your-own-long-random-value
BACKEND_IMAGE=ghcr.io/alex/mern-notes-backend
FRONTEND_IMAGE=ghcr.io/alex/mern-notes-frontend
IMAGE_TAG=sha-REPLACE_WITH_FULL_COMMIT_SHA_FROM_MAIN_RUN
```

Use your own lowercase names. Do not include `:tag` in the image variables; Compose
adds `IMAGE_TAG` to each. Use the SHA of the successful **main run** (a merge can
produce a new commit SHA), not a previous feature-branch SHA. `latest` is also
available, but use the commit tag as submission evidence.

```sh
docker compose -f compose.published.yaml pull
docker compose -f compose.published.yaml up -d --wait
docker compose -f compose.published.yaml ps
```

Open http://localhost:3000. Sign up, create/edit/delete a note, log out, and log
back in. Restart the stack and verify data persists. This stack has its own
MongoDB volume, separate from the source-built stack. It runs the same development
servers, downloaded from the registry. It contains no local build directives or
source mounts. Do not run `docker build` on your laptop to complete this step.

```sh
docker compose -f compose.published.yaml logs
docker compose -f compose.published.yaml down
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot connect to Docker | Docker Desktop running with Linux containers |
| Missing session secret | Root `.env` exists for local app startup |
| Backend tests cannot connect | Test MongoDB health/logs in `compose.test.yaml` |
| GHCR permission denied | `packages: write`, correct namespace, package Actions access |
| Invalid image reference | Lowercase image names, no duplicate `:tag` |
| Pull denied | Package exists and is public, or log in for private access |
| Port 3000 occupied | Stop the other stack |
| App not immediately ready | CRA compilation takes time; inspect frontend logs |
| Login fails | CRA container proxy and backend/Mongo health/logs |
| Tests use old code | Rebuild test images after edits |
| Feature branch does not publish | Expected; publishing runs only on main |
| Main fails to publish | Earlier failures, condition, permissions, or package access |

## Submit and explain

Submit your repository/workflow link, a failed-then-fixed test run, a successful
main publishing run, links to both GHCR packages, and the shared commit tag.
Include evidence that the downloaded app works. Never submit `.env` or secrets.

Explain what each supplied block does. Why do failed tests prevent publication?
What replaces the calculator's artifact upload? Why does publishing not make a
website available online? What is the difference between a tag and a digest?

Production packaging, Nginx, HTTPS, online hosting, and automatic server deployment
are outside this lab. These development images retain the original dependencies;
a production/security review is a separate task.

## References

- [Publishing Docker images with GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [Working with GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
