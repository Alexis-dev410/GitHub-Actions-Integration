# Week 9 Session 2: MERN CI/CD Student Starter

A ready-to-run notes app: React TypeScript (CRA), Express TypeScript, and MongoDB.
Dockerfiles, test cases, and Compose files are supplied. **You implement the GitHub
Actions workflow.** No completed workflow is included in this starter.

## Start here

Install Git and Docker Desktop with Linux containers and Compose v2. Start Docker
Desktop and check `docker version` and `docker compose version`. Local Node is
optional; the container commands below use Node 22.

Create your own repository from this starter (fork it, or use GitHub's template
feature if your instructor enables it). Clone your copy and run commands from its
root. Use a public repository for the classroom exercise.

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), then
replace `SESSION_SECRET` with a long random value. For example, generate one with:

```sh
docker run --rm node:22-bookworm-slim node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```sh
docker compose up --build -d --wait
```

Open http://localhost:3000. Sign up, create a note, edit it, log out and log back
in. API requests go through Nginx to `backend:5000`; cookies stay on the browser's
frontend origin. MongoDB is internal to the Docker network. Only the frontend
port is published, bound to localhost.

```sh
docker compose ps
docker compose logs backend
docker compose down
```

Database data survives `down` in a named volume. `down --volumes` deletes it.
These files are for a local classroom demonstration. Public hosting additionally
requires HTTPS, appropriate cookie/proxy settings, database access controls and
backup planning. Never commit `.env` or bake secrets into an image.

## Run the supplied tests

These commands build dedicated test targets; runtime images contain no test tools.

```sh
docker compose -f compose.test.yaml build
docker compose -f compose.test.yaml run --rm backend-test
docker compose -f compose.test.yaml run --rm frontend-test
docker compose -f compose.test.yaml run --rm backend-test npm run lint
docker compose -f compose.test.yaml run --rm backend-test npm run typecheck
docker compose -f compose.test.yaml down --volumes
```

Run commands separately and check each exit code. Rebuild after editing tests or
source: there are no source bind mounts. Backend tests use an isolated, temporary
MongoDB instance and a database name ending in `_test`. They delete test records.
Never point them at a database containing data you want to keep. Frontend tests
need no database.

For native Node 22 use, run `npm ci` separately in each package. Backend scripts:
`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm start`.
Tests require a reachable MongoDB database; set `TEST_MONGO_URI` to its test URI.
`npm run dev` uses Nodemon and reads `backend/.env` (see its example). Frontend
scripts: `npm run test:ci`, `npm run build`, `npm start`. Native frontend development
proxies to localhost:5000; the production container instead uses Nginx.

## Files you will use

| File | Purpose |
| --- | --- |
| `backend/Dockerfile` | Test target, TypeScript build, non-root Node runtime |
| `frontend/Dockerfile` | Test target, CRA build, Nginx runtime |
| `frontend/nginx.conf` | SPA routing and same-origin `/api` forwarding |
| `compose.yaml` | Build and run the supplied app locally |
| `compose.test.yaml` | Run the provided tests against a separate database |
| `compose.published.yaml` | Pull and run your GHCR images, with no local builds |
| `docs/student-lab.md` | Workflow assignment and explanations |

Both runtime images are built with `docker build ./backend` and
`docker build ./frontend` respectively. Neither build requires application secrets
or a running database. Building a runtime image does not execute the tests;
your workflow must run them and block publication on failure.

Continue with [the student lab](docs/student-lab.md).

## Attribution

Adapted from [Coding in Flow's MERN course](https://github.com/codinginflow/MERN-course)
and [video tutorial](https://www.youtube.com/watch?v=FcxjCPeicvU).
The original application and its dependency stack are retained for this lesson.
