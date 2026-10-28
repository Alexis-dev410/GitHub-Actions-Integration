# Week 9 - Thursday session — MERN CI/CD

Implement a single-job GitHub Actions workflow that tests this app, builds its
Docker images, and publishes them to GHCR. Start from the calculator workflow;
Docker/GHCR snippets are supplied in [the lab](docs/student-lab.md).

The starter includes development Dockerfiles (CRA and Nodemon), seven tests,
and three Compose configurations. Publishing and local verification are in scope;
online deployment is not.

## Local verification

Work individually in your own fork. With Docker Desktop running, copy
`.env.example` to `.env` and set `SESSION_SECRET`. Run from the repository root:

```sh
docker compose up --build -d --wait
```

Verify the app at http://localhost:3000, then run the supplied checks:

```sh
docker compose -f compose.test.yaml build
docker compose -f compose.test.yaml run --rm backend-test
docker compose -f compose.test.yaml run --rm frontend-test
docker compose -f compose.test.yaml run --rm backend-test npm run lint
docker compose -f compose.test.yaml run --rm backend-test npm run typecheck
docker compose -f compose.test.yaml down --volumes
```

The test commands use a separate temporary MongoDB automatically; no database
setup is needed. After editing code or tests, rerun the relevant build command
so the containers include your changes. `docker compose down` stops the app and
keeps its saved data; adding `--volumes` deletes that data. Keep `.env` out of Git.

| Configuration | Use |
| --- | --- |
| `compose.yaml` | Build and run locally |
| `compose.test.yaml` | Tests, lint, and type checking |
| `compose.published.yaml` | Pull and run GHCR images |


