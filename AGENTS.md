<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Product overview
Atlas Cargo FFMP — a Next.js 16 + Prisma + SQLite freight forwarding management platform (single service, no external dependencies).

### Running the app
1. Create `.env` at repo root if missing (see `.env` values below).
2. `npx prisma generate` → `npx prisma migrate dev` → `npm run prisma:seed` (seeds admin user `admin@atlascargo.local` / `Admin123!`).
3. `npm run dev` starts the Next.js dev server on port 3000.

Required `.env` values:
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="dev-secret-key-for-local-development-only"
NEXTAUTH_URL="http://localhost:3000"
```

### Lint / Test / Build
- Lint: `npm run lint`
- Build: `npm run build`
- No automated test suite exists yet.

### Gotchas
- The Prisma schema uses SQLite with `better-sqlite3` adapter (`@prisma/adapter-better-sqlite3`). The database file lives at `prisma/dev.db`.
- `prisma.config.ts` loads env via `dotenv/config`, so the `.env` file must exist before running any Prisma commands.
- The seed script is idempotent — re-running it is safe.
