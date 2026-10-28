# Week 9 Session 2: MERN CI/CD Student Starter

A notes app using React TypeScript (Create React App), Express TypeScript, and
MongoDB. The Dockerfiles preserve the familiar development setup: the frontend
runs `npm start` (CRA), and the backend runs `npm start` (Nodemon).

This lesson covers automated tests, Docker image building, and publishing to GHCR.
It does not cover production hosting. There is no Nginx or production build stage.
**You implement the workflow.** The lab supplies code for the unfamiliar
Docker/GHCR parts, using the same single-job structure as the calculator exercise.

## Start here

Install Git and Docker Desktop with Linux containers and Compose v2. Start Docker
Desktop and check `docker version` and `docker compose version`. Local Node is
optional; Node 22 and dependencies are installed inside the images.

Each student works alone: fork this repository, clone your fork, and run commands
from its root. Use a public repository for the classroom exercise.

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), then
replace `SESSION_SECRET` with a long random value. You can generate one with:

```sh
docker run --rm node:22-bookworm node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```sh
docker compose up --build -d --wait
```

`--build` builds the images; `-d` runs the app in the background; `--wait` waits for
health checks before returning. Open http://localhost:3000. Sign up, create and
edit a note, then log out and log back in.

The CRA development server forwards `/api` requests to `backend:5000` inside
Docker. Cookies stay on the frontend origin. MongoDB and the backend are internal
to the Docker network. Only frontend port 3000 is published, bound to localhost.
These are development images for a local lab, including when downloaded from GHCR.
Publishing an image does not deploy a website.

```sh
docker compose ps
docker compose logs backend
docker compose down
```

MongoDB data persists in a named volume after `down`. `down --volumes` deletes it.
There are no source bind mounts: rebuild after editing source, tests, or package
files. Never commit `.env` or put real secrets inside images.

## Run the supplied tests

The same simple Dockerfiles are used for testing. Compose overrides `npm start`
with the test command. Test MongoDB is separate and temporary.

```sh
docker compose -f compose.test.yaml build
docker compose -f compose.test.yaml run --rm backend-test
docker compose -f compose.test.yaml run --rm frontend-test
docker compose -f compose.test.yaml run --rm backend-test npm run lint
docker compose -f compose.test.yaml run --rm backend-test npm run typecheck
docker compose -f compose.test.yaml down --volumes
```

Run these separately and check each exit code. Backend tests delete test records;
they require a database name ending in `_test`. Never point them at application
data. Frontend tests do not need MongoDB.

For native Node 22 use, run `npm ci` in each package. The backend supports
`npm start`, `npm test`, `npm run lint`, and `npm run typecheck`. Native app startup
reads `backend/.env` (see its example) and requires your own running MongoDB.
Tests use `TEST_MONGO_URI` or a local `mern_notes_test` database. The frontend
supports `npm start`, `npm run test:ci`, and its original `npm run build` command.
Its native development proxy remains `localhost:5000`; only the image changes
that proxy to the Compose service hostname `backend`.

## Supplied files

| File | Purpose |
| --- | --- |
| `backend/Dockerfile` | Install dependencies, copy source, run Nodemon |
| `frontend/Dockerfile` | Install dependencies, set container proxy, run CRA |
| `compose.yaml` | Build and run the app locally with MongoDB |
| `compose.test.yaml` | Run tests against an isolated test database |
| `compose.published.yaml` | Run registry images without building locally |
| `.env.example` | Local secret and image-name settings to copy into `.env` |
| `docs/student-lab.md` | Basic workflow assignment plus supplied Docker/GHCR code |

A Docker image build packages the development app; it does not run tests or
compile a production release. Your workflow explicitly runs tests, lint, and
backend type checking before building and publishing images.

Continue with [the student lab](docs/student-lab.md).

## Attribution

Adapted from [Coding in Flow's MERN course](https://github.com/codinginflow/MERN-course)
and [video tutorial](https://www.youtube.com/watch?v=FcxjCPeicvU).
The original application's dependency stack is retained for this classroom lesson.
