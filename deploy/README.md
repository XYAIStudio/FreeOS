# Community container

This directory provides a single-node community evaluation container. It is not a production certification or a high-availability deployment.

1. Copy `.env.example` to `.env`.
2. Replace both secret placeholders with independent random values.
3. Run `docker compose -f deploy/docker-compose.yml up --build` from the repository root.

The default community container uses SQL.js-backed SQLite and persistent Docker volumes. Production operators must separately validate database migrations, backups, restore, TLS, CORS, monitoring, capacity, and restart recovery.
