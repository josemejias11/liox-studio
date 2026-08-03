# Reset the local Moto AI database

This procedure intentionally destroys one local development database. It does
not reset a PostgreSQL server, a shared database, production data, R2 objects,
or ChromaDB. It is valid only for the named local database `moto_ai_dev`. Stop
immediately if either configured URL identifies a shared or production target.

1. Stop Moto AI's web app and job worker. Stop the local parser service if it
   is running.
2. Verify both configured URLs without printing usernames or passwords. This
   command rejects a non-local host or a database other than `moto_ai_dev`:

   ```bash
   node --env-file=.env --input-type=module -e '
   for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
     const value = process.env[name];
     if (!value) throw new Error(`${name} is not set`);
     const url = new URL(value);
     const database = decodeURIComponent(url.pathname.slice(1));
     if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(url.hostname) || database !== "moto_ai_dev") {
       throw new Error(`${name} is not an approved local Moto AI target`);
     }
     console.log(`${name}: host=${url.hostname} port=${url.port || "5432"} database=${database}`);
   }
   '
   ```

3. Recreate only the verified `DIRECT_URL` target. The command derives its
   host, port, username, and password from `DIRECT_URL` without emitting those
   credentials; it connects to that same server's `postgres` maintenance
   database and passes only `moto_ai_dev` as the database to drop or create.

   ```bash
   node --env-file=.env --input-type=module -e '
   import { spawnSync } from "node:child_process";
   const url = new URL(process.env.DIRECT_URL ?? "");
   const database = decodeURIComponent(url.pathname.slice(1));
   if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(url.hostname) || database !== "moto_ai_dev") {
     throw new Error("DIRECT_URL is not an approved local Moto AI target");
   }
   const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: "postgres" };
   if (url.username) env.PGUSER = decodeURIComponent(url.username);
   if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
   for (const [command, args] of [["dropdb", ["--if-exists", "moto_ai_dev"]], ["createdb", ["moto_ai_dev"]]]) {
     const result = spawnSync(command, args, { env, stdio: "inherit" });
     if (result.status !== 0) process.exit(result.status ?? 1);
   }
   '
   ```

4. Apply the repository's committed schema:

   ```bash
   npm run db:migrate
   ```

5. Start each required service in a separate terminal:

   Terminal 1:
   ```bash
   npm run dev
   ```

   Terminal 2:
   ```bash
   npm run jobs:worker
   ```

   Start `services/parser-service` separately only when local grounded-AI
   features are needed.

The reset removes Moto AI database data, including courses, revisions, reviews,
progress, quizzes, sources, jobs, and asset metadata. It does not remove R2
objects; remove unreferenced local-development media deliberately through the
storage workflow if necessary.
