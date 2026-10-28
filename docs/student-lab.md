# Student lab: automate checks, builds, and delivery to GHCR

## Your goal

Starting from the working Dockerized app, implement `.github/workflows/ci-cd.yml`.
On a pull request, verify the code and build the runtime images without publishing.
On a successful push to `main`, publish both images to GitHub Container Registry
(GHCR). Then run the published application locally without rebuilding it.

The Dockerfiles and tests are supplied. The workflow is your implementation.
Complete the README's local startup and test checks first.

## 1. Understand what moves through the pipeline

Source code goes to a GitHub repository. A GitHub Actions runner checks that code
and builds images. GHCR stores the images. Docker on your laptop pulls the images
and creates containers. A registry does not host a running application.

Each package uses a lockfile and `npm ci`. The backend tests verify authentication,
note CRUD, and isolation between users. Frontend tests verify rendering and user
interaction. A failed test must prevent image publication.

## 2. Create the workflow and checks job

Create the workflow directory and YAML file. Configure `push` to `main` and
`pull_request` targeting `main`; optionally include `workflow_dispatch` for manual
runs. Use Ubuntu runners. Begin with `contents: read` permissions.

In a checks job, check out the code, then automate the following commands using
separate steps so that a failure stops the job:

```sh
docker compose -f compose.test.yaml build
docker compose -f compose.test.yaml run --rm backend-test
docker compose -f compose.test.yaml run --rm frontend-test
docker compose -f compose.test.yaml run --rm backend-test npm run lint
docker compose -f compose.test.yaml run --rm backend-test npm run typecheck
```

Add a cleanup step using `if: always()` that runs:

```sh
docker compose -f compose.test.yaml down --volumes
```

The Ubuntu runner already supplies Docker. Test MongoDB runs on the Compose
network at `mongo-test:27017`. No database password or real application secret is
needed for the disposable test environment. This test file does not use root `.env`.
Do not add `continue-on-error` or ignore failing exit codes.

Push this first version. Open the Actions tab and inspect the logs. Deliberately
change a tested expectation so it fails, observe the red run, then restore it.

## 3. Build the runtime images

Add an image job that depends on the checks job using `needs`. Jobs run on separate
runners: check out the repository again in this job. Set up Docker Buildx.

Use `docker/build-push-action` for each app:

| App | Build context | Dockerfile | Target |
| --- | --- | --- | --- |
| Backend | `./backend` | `./backend/Dockerfile` | `runtime` |
| Frontend | `./frontend` | `./frontend/Dockerfile` | `runtime` |

The default final stage is also `runtime`. A repository-root context will not
match the supplied Dockerfiles' `COPY package.json package-lock.json ./` paths.
Do not try to reuse another job's local images; build in the image job.

On pull requests, run these builds with publishing disabled. This checks the
production compilation and Docker packaging even though the source tests passed.

## 4. Authenticate and publish on main

Choose two image names in your own GitHub namespace:

```text
ghcr.io/<lowercase-owner>/<lowercase-repository>-backend
ghcr.io/<lowercase-owner>/<lowercase-repository>-frontend
```

Normalize both owner and repository to lowercase; GitHub account names may contain
uppercase letters. Use the actual current repository, not the instructor's.

Grant the image job `contents: read` and `packages: write`. Use
`docker/login-action` with registry `ghcr.io`, username from `github.actor`, and
password from `secrets.GITHUB_TOKEN`. This token is supplied automatically: do not
create a secret containing your GitHub password or put a token in the YAML.

Make login and publishing conditional on **both** a `push` event and
`refs/heads/main`. Builds on pull requests and optional manual runs should not
publish. Use the same condition for the build action's `push` input. The job's
dependency must prevent it from running after failed checks.

For each image publish two tags: `latest` and `sha-<full github.sha>`. The commit
tag traces a version to its source; `latest` moves with successful main builds.
Use the same commit tag for both images. Optionally add a concurrency group for
main publishing so older runs cannot overwrite a newer `latest` tag.

Add the OCI source label `org.opencontainers.image.source` pointing at your
repository URL. Pin third-party actions to reviewed commit SHAs, following the
official examples. Docker metadata action is available if you want to automate
tag and label generation; it is optional for this lesson.

Push or merge a passing change to main. Find both packages on your GitHub profile's
Packages tab. New packages start private; for this public classroom app, change
each package's visibility to public so the next step needs no registry login.
Do not include secrets or personal data in these images.

## 5. Pull and run exactly what the workflow published

Stop the source-built stack first to free port 3000:

```sh
docker compose down
```

In root `.env`, set `FRONTEND_IMAGE` and `BACKEND_IMAGE` to your image names without
tags. Set `IMAGE_TAG=sha-<full commit SHA from the passing run>` and retain your
local session secret. Both image names must be lowercase. The Compose file adds
the tag for you. You may use `latest` initially, but use the commit tag as evidence.

```sh
docker compose -f compose.published.yaml pull
docker compose -f compose.published.yaml up -d --wait
docker compose -f compose.published.yaml ps
```

Open http://localhost:3000. Sign up, create and edit a note, then log out and log
back in. The published stack has its own database volume; source-stack accounts
will not automatically appear here. Restart the stack and verify your data stays.
There are no build directives or source bind mounts in this file. Only the Compose
file, runtime `.env`, and Docker are needed on another computer.

```sh
docker compose -f compose.published.yaml logs
docker compose -f compose.published.yaml down
```

Do not publish images from your laptop for this exercise: demonstrate that your
workflow produced them. Do not push the upstream MongoDB image into your namespace.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot connect to Docker | Docker Desktop running; Linux containers selected |
| Missing session secret | Root `.env` created and populated for app startup |
| Tests cannot connect | Use `compose.test.yaml`; inspect `mongo-test` health/logs |
| GHCR permission denied | Correct namespace, job permissions, package Actions access |
| Invalid image reference | Lowercase names; no duplicate `:tag` in image variable |
| Pull denied | Package exists and is public, or authenticate for private access |
| Port 3000 occupied | Stop the other stack first |
| Frontend loads but login fails | Backend/Mongo health; Nginx `/api` proxy logs |
| Tests use old code | Rebuild test images after edits |
| Main workflow never publishes | Event/branch condition, `needs`, and prior failures |

## Submit

- Repository link and your workflow file.
- A failed test run followed by the corrected passing run.
- A successful main run with both published packages linked.
- The commit tag used for both images and evidence that the published stack is
  healthy and note operations work. Never submit `.env` or secret values.

Explain: Why run tests before publishing? How does a tag differ from a digest?
Why does GHCR publication not make an app publicly accessible? What would a server
need to run the same images?

This lab implements CI and delivery of container artifacts, verified locally.
Automated deployment to an online server is a later step. These base image tags
can move; release processes can pin digests for exact reproducibility.

## Official references

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Publishing Docker images with Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GHCR authentication and visibility](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
