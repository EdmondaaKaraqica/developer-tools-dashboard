# developer-tools-dashboard

Developer tools landing page (Vue) + admin link management (NestJS + Elasticsearch).

## What it does

- **Developers** open the landing page and click links to internal tools.
- **Admins** sign in and **create/update/delete** links (title, URL, icon, description, sort order).
- Links are stored in **Elasticsearch** and shown on the landing page.

## Run with Docker (full stack)

This runs **frontend + backend + Elasticsearch** as OCI containers.

```bash
docker compose up -d --build
```

- **UI**: `http://localhost:8080`
- **API**: `http://localhost:3000`
- **Elasticsearch**: `http://localhost:9200`

To stop:

```bash
docker compose down
```

Data persistence: Elasticsearch data is stored in a Docker volume. It survives `down/up`, but is deleted if you run `docker compose down -v`.

## Endpoints (quick reference)

- **Health**: `GET /health`
- **Readiness** (checks Elasticsearch/index): `GET /ready`
- **Login (JWT)**: `POST /api/auth/login`
- **Links (public)**: `GET /api/links?page=1&pageSize=10`
- **Links (admin)**: `POST/PATCH/DELETE /api/links` (Bearer token required)

## Configuration

Backend environment variables (see `backend/.env.example`):

- **ELASTICSEARCH_NODE**: Elasticsearch URL
- **ELASTICSEARCH_INDEX**: index name used for links
- **JWT_SECRET**: JWT signing secret (HS256)
- **JWT_EXPIRES_IN**: token lifetime (e.g. `8h`)
- **ADMIN_USERNAME**: admin login name
- **ADMIN_PASSWORD_HASH**: bcrypt hash for the admin password (wrap in **double quotes** on Windows)

Security note: **don’t commit `backend/.env`**. Use `.env.example` for defaults and set real secrets via environment variables in production.

## Frontend configuration

Set the API base URL in `frontend/.env` (see `frontend/.env.example`):

```bash
VITE_API_BASE=
```

Leave it empty for local development (the Vite dev server proxies `/api` to the backend).

## Repo layout (why frontend + backend are together)

This repository is a simple monorepo with `frontend/` and `backend/` folders so reviewers can **clone once** and run the whole stack easily (especially via Docker Compose). The frontend and backend still build and run independently.

## Notes on pagination

`GET /api/links` uses Elasticsearch `from`/`size` pagination. This is simple and fast for the expected (small) dataset size of an internal links portal. For very large datasets or deep pagination, prefer `search_after` for better performance.

## Using the app

1. Open the UI: `http://localhost:8080`
2. Go to **Admin**
3. Login (demo default): `admin` / `password`
4. Add links
5. Go back to **Links** to see them

## API examples (Postman / curl equivalent)

Login:

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{"username":"admin","password":"password"}
```

Create a link (requires `Authorization: Bearer <token>`):

```bash
POST http://localhost:3000/api/links
Content-Type: application/json
Authorization: Bearer <token>

{"title":"Test","url":"https://tool.example.com","icon":"📊","description":"test test","sortOrder":0}
```

## Run the API locally

1. **Start Elasticsearch** (required — the API fails fast if it cannot connect):

   ```bash
   docker compose up -d elasticsearch
   ```

   Wait until `http://localhost:9200` responds (first start can take ~30–60s).

2. **Backend** (`backend/`):

   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

   Env: copies `backend/.env.example` to `backend/.env` if you want overrides; otherwise `.env.example` is loaded automatically.

3. **Frontend** (`frontend/`) — Vue + Vite (dev server proxies `/api` to the backend):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open **http://localhost:5173** — **Links** is the public landing page; **Admin** is login + CRUD (JWT).  
   Default API user (from backend `.env.example`): `admin` / `password`.

   **Login still fails?** (1) Stop the API, start it again from `backend/`. (2) If you have `backend/.env`, either delete it or set `ADMIN_PASSWORD_HASH` to the **quoted** line from `.env.example`.

   Production build: `npm run build` in `frontend/` (set `VITE_API_BASE` if the API is on another host).
