/**
 * Wipe all data from a MongoDB database in the cluster the API is configured for.
 *
 * Reuses the app's own validated env (`MONGO_URI`) and connection, so by default
 * it targets the same database as the URI's path (e.g. `/chathub`).
 *
 * Usage (from the `api/` directory):
 *   npm run db:clear                      # DRY RUN — prints target + per-collection counts
 *   npm run db:clear -- --yes             # delete every document (keeps collections + indexes)
 *   npm run db:clear -- --yes --drop      # drop the collections entirely (also removes indexes)
 *   npm run db:clear -- --db test --yes   # target a specific database (e.g. Mongoose's default `test`)
 *
 * Notes:
 *   - npm needs the `--` separator, otherwise it swallows the flags itself.
 *   - Defaults to a dry run; nothing is deleted without --yes (or -y).
 *   - Refuses to run when NODE_ENV=production unless --force is also passed.
 */
import mongoose from "mongoose";
import { env, isProd } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { logger } from "../src/utils/logger.js";

const argv = process.argv.slice(2);
const has = (flag: string): boolean => argv.includes(flag);

const confirmed = has("--yes") || has("-y");
const drop = has("--drop");
const force = has("--force");

const dbFlagIndex = argv.indexOf("--db");
const targetDbName = dbFlagIndex !== -1 ? argv[dbFlagIndex + 1] : undefined;

const SYSTEM_DBS = new Set(["admin", "local", "config"]);

/** Hide credentials in a mongodb URI before logging it. */
function redactUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:****@");
}

/** Find other (non-system) databases in the cluster that still hold collections. */
async function findOtherNonEmptyDbs(currentDbName: string): Promise<string[]> {
  try {
    const admin = mongoose.connection.db!.admin();
    const { databases } = await admin.listDatabases();
    const result: string[] = [];
    for (const d of databases) {
      if (d.name === currentDbName || SYSTEM_DBS.has(d.name)) continue;
      const cols = await mongoose.connection.useDb(d.name).db!.listCollections().toArray();
      if (cols.length > 0) result.push(`${d.name} (${cols.length} collection(s))`);
    }
    return result;
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  if (isProd && !force) {
    logger.error(
      "Refusing to clear the database while NODE_ENV=production. Re-run with --force to override.",
    );
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const db = targetDbName
    ? mongoose.connection.useDb(targetDbName).db
    : mongoose.connection.db;
  if (!db) throw new Error("No active database connection.");

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."));

  console.log(`\nTarget:   ${redactUri(env.MONGO_URI)}`);
  console.log(`Database: ${db.databaseName}${targetDbName ? " (from --db)" : " (from URI)"}`);

  if (collections.length === 0) {
    console.log("\nNo collections to clear — this database is empty.");
    const others = await findOtherNonEmptyDbs(db.databaseName);
    if (others.length > 0) {
      console.log(
        "\n⚠ Other databases in this cluster DO contain data:\n  - " + others.join("\n  - "),
      );
      console.log(
        "If your app wrote there (e.g. the URI had no db name → Mongoose defaults to `test`),\n" +
          "target it explicitly, e.g.:  npm run db:clear -- --db test --yes",
      );
    }
    return;
  }

  let total = 0;
  for (const name of collections) {
    const count = await db.collection(name).countDocuments();
    total += count;
    console.log(`  • ${name}: ${count} document(s)`);
  }

  if (!confirmed) {
    console.log(
      `\nDry run — nothing was deleted. ${total} document(s) across ${collections.length} ` +
        `collection(s) would be ${drop ? "dropped" : "cleared"}.`,
    );
    console.log("Re-run with --yes to proceed (add --drop to remove indexes too).");
    return;
  }

  for (const name of collections) {
    if (drop) {
      await db.collection(name).drop();
      console.log(`  ✓ dropped ${name}`);
    } else {
      const res = await db.collection(name).deleteMany({});
      console.log(`  ✓ cleared ${name} (${res.deletedCount} removed)`);
    }
  }

  console.log(
    `\nDone. ${drop ? "Dropped" : "Cleared"} ${collections.length} collection(s) in "${db.databaseName}".`,
  );
}

main()
  .catch((err) => {
    logger.error({ err }, "Failed to clear database");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
