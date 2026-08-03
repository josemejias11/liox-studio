# Reset the local Moto AI database

This procedure intentionally destroys one local development database. It does
not reset a PostgreSQL server, a shared database, production data, R2 objects,
or ChromaDB. Confirm that the target is the named Moto AI database
`moto_ai_dev` before continuing.

1. Stop Moto AI's web app and job worker. Stop the local parser service if it
   is running.
2. Confirm `.env` points both `DATABASE_URL` and `DIRECT_URL` to
   `moto_ai_dev` on the intended local PostgreSQL instance.
3. Recreate only that database:

   ```bash
   dropdb --if-exists moto_ai_dev
   createdb moto_ai_dev
   ```

4. Apply the repository's committed schema:

   ```bash
   npm run db:migrate
   ```

5. Start the required services again:

   ```bash
   npm run dev
   npm run jobs:worker
   ```

   Start `services/parser-service` separately only when local grounded-AI
   features are needed.

The reset removes Moto AI database data, including courses, revisions, reviews,
progress, quizzes, sources, jobs, and asset metadata. It does not remove R2
objects; remove unreferenced local-development media deliberately through the
storage workflow if necessary.
