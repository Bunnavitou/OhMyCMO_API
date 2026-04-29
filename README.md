# OhMyCMO API

Node.js + Express + Prisma + PostgreSQL backend for the OhMyCMO React + Vite frontend.

## Topology

```
Internet ──▶ frontend :1111 (public, 0.0.0.0)
                │
                └─ proxy /api ──▶ backend :1112 (loopback only, 127.0.0.1)
                                       │
                                       └──▶ PostgreSQL :5432 (loopback)
```

The browser only ever talks to the frontend on port `1111`. Requests to
`/api/*` are proxied by the frontend (Vite dev server in dev, nginx/Caddy in
prod) over the loopback interface to the backend on port `1112`. The backend
binds to `127.0.0.1` only, so it is unreachable from the internet.

Includes:
- JWT auth (access + refresh tokens, refresh in httpOnly cookie)
- Role-based access (USER / ADMIN)
- CRUD APIs (users, posts) with pagination & search
- Zod validation, central error handling
- Helmet, rate limiting, request logging
- Per-environment config via `.env.development` / `.env.production` switched by `NODE_ENV`

---

## 1. Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 13+ running locally
- npm

Verify Postgres is reachable:

```bash
psql -h localhost -U postgres -c "select version();"
```

---

## 2. Create the databases

### Development DB

```bash
createdb my_dev_db
# or via psql:
# psql -U postgres -c "CREATE DATABASE my_dev_db;"
```

### Production DB

```bash
psql -U postgres <<'SQL'
CREATE DATABASE my_prod_db;
ALTER USER postgres WITH PASSWORD 'StrongP@ssw0rd!';
SQL
```

> The production `DATABASE_URL` URL-encodes the password:
> raw `StrongP@ssw0rd!` → encoded `StrongP%40ssw0rd%21`.

---

## 3. Install & configure

```bash
cd OhMyCMO_API
npm install
```

Environment files are already provided:

- `.env.development` — used when `NODE_ENV=development`
- `.env.production` — used when `NODE_ENV=production`

`src/config/env.js` reads `NODE_ENV` and loads the matching file.

> Replace the `JWT_*_SECRET` values in `.env.production` with real long random strings before deploying.

---

## 4. Generate Prisma client & run migrations

### Development

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
```

(Optional) seed demo data:

```bash
npm run db:seed
```

Demo accounts created by the seed:

| Email                    | Password   | Role  |
|--------------------------|------------|-------|
| admin@ohmycmo.local      | Admin@123  | ADMIN |
| user@ohmycmo.local       | User@123   | USER  |

### Production

```bash
npm run prisma:migrate:deploy
```

---

## 5. Run the server

### Development (auto-reload)

```bash
npm run dev
# -> http://localhost:1112
```

### Production

```bash
npm start
```

Health check:

```bash
curl http://localhost:1112/api/health
```

---

## 6. API overview

Base URL: `http://localhost:1112/api`

### Auth — `/api/auth`

| Method | Path        | Auth | Body                                      |
|-------:|-------------|------|-------------------------------------------|
| POST   | `/register` | —    | `{ email, password, name? }`              |
| POST   | `/login`    | —    | `{ email, password }`                     |
| POST   | `/refresh`  | cookie or `{ refreshToken }` | —          |
| POST   | `/logout`   | —    | —                                         |
| GET    | `/me`       | Bearer | —                                       |

`login` and `register` return:

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "name": "...", "role": "USER" },
    "accessToken": "<jwt>"
  }
}
```

The refresh token is set as an httpOnly cookie scoped to `/api/auth`.

### Users — `/api/users` (auth required)

| Method | Path   | Role         | Notes                                 |
|-------:|--------|--------------|---------------------------------------|
| GET    | `/`    | ADMIN        | `?page=&limit=&search=`               |
| GET    | `/:id` | any auth     |                                       |
| PATCH  | `/:id` | self / ADMIN | role change requires ADMIN            |
| DELETE | `/:id` | self / ADMIN |                                       |

### Posts — `/api/posts`

| Method | Path   | Auth         | Notes                                                       |
|-------:|--------|--------------|-------------------------------------------------------------|
| GET    | `/`    | public       | `?page=&limit=&published=true|false&authorId=&search=`      |
| GET    | `/:id` | public       |                                                             |
| POST   | `/`    | Bearer       | `{ title, content?, published? }`                           |
| PATCH  | `/:id` | author / ADMIN | partial update                                            |
| DELETE | `/:id` | author / ADMIN |                                                           |

### Error shape

```json
{ "success": false, "error": { "message": "...", "details": [ ... ] } }
```

---

## 7. Calling the API from the React + Vite frontend

The frontend uses a **same-origin path** (`/api`). The Vite dev server (and
your reverse proxy in production) forwards `/api/*` to the backend on
`http://127.0.0.1:1112`. The browser never sees `:1112`.

Frontend `.env.development` / `.env.production`:

```
VITE_API_URL=/api
```

Example login call:

```js
const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // important — receives the httpOnly refresh cookie
  body: JSON.stringify({ email, password }),
});
const { data } = await res.json();
localStorage.setItem('accessToken', data.accessToken);
```

Authenticated requests:

```js
fetch(`${import.meta.env.VITE_API_URL}/posts`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
  credentials: 'include',
});
```

Refresh on 401:

```js
await fetch(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
  method: 'POST',
  credentials: 'include',
});
```

Because the calls are same-origin, **CORS is not exercised in normal use**.
The `CORS_ORIGIN` setting acts as defense-in-depth for any direct API call.

---

## 8. Useful scripts

```bash
npm run dev                     # nodemon, NODE_ENV=development
npm start                       # node, NODE_ENV=production
npm run prisma:generate         # generate Prisma client
npm run prisma:migrate:dev      # create/apply dev migrations
npm run prisma:migrate:deploy   # apply migrations on prod DB
npm run prisma:studio:dev       # Prisma Studio against dev DB
npm run prisma:studio:prod      # Prisma Studio against prod DB
npm run db:seed                 # seed demo accounts + posts (dev DB)
```

---

## 9. Project structure

```
OhMyCMO_API/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── app.js                  # Express app factory
│   ├── index.js                # Entry point + graceful shutdown
│   ├── config/
│   │   ├── env.js              # Loads .env.<NODE_ENV>
│   │   └── prisma.js           # Prisma client singleton
│   ├── controllers/            # auth, user, post
│   ├── middleware/             # auth, validate, error
│   ├── routes/                 # auth, user, post, index
│   ├── utils/                  # ApiError, asyncHandler, jwt
│   └── validators/             # Zod schemas
├── .env.development
├── .env.production
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 10. Production notes

- Replace all `JWT_*_SECRET` values with long random strings.
- Set `CORS_ORIGIN` to your real frontend origin (HTTPS).
- Serve over HTTPS so `COOKIE_SECURE=true` works.
- Backend listens on `127.0.0.1:1112` only. Do **not** publish port 1112 in
  your firewall — the public reverse proxy must reach it over loopback.
- Run `npm run prisma:migrate:deploy` on each deploy before starting the app.

### Reverse proxy (nginx) example

`vite preview` is fine for quick checks but is not a hardened production
server. In production, build the frontend (`npm run build` in `OhMyCMO/`)
and serve `dist/` from nginx, with `/api` proxied to the backend:

```nginx
server {
    listen 443 ssl http2;
    server_name your-frontend-domain.com;

    # SSL config omitted

    root /var/www/ohmycmo/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri /index.html;
    }

    # API proxy — same origin, no CORS
    location /api/ {
        proxy_pass         http://127.0.0.1:1112;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

With this setup the backend never appears on the public internet — it only
accepts connections from nginx over `127.0.0.1`.
