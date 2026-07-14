This migration was created manually because the database was not reachable in the test environment. 

To apply it, connect to your Postgres instance and run the SQL in `migration.sql`, or use `npx prisma migrate deploy` once the prisma migration directory is committed and the database is available.

It simply adds the `schemaState json` column to the `Lead` table, which is required for the new schema-state feature.