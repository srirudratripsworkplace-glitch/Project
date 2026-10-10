
require("dotenv").config();
require("dotenv").config({
  path: ".env.supabase",
  override: false,
  quiet: true
});

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const tables = [
  "trip_categories",
  "destinations",
  "special_trips",
  "customer_reviews",
  "enquiries"
];

const ca = fs.readFileSync(
  path.join(__dirname, "certs", "supabase-prod-ca-2021.crt"),
  "utf8"
);

function makeClient(connectionString, ssl) {
  return new Client({ connectionString, ssl });
}

async function getRows(client, table) {
  const result = await client.query(`SELECT * FROM "${table}"`);
  return result.rows;
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) {
    console.log(`${table}: 0 rows`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const columnSql = columns
    .map(column => '"' + column.replace(/"/g, '""') + '"')
    .join(", ");

  for (const row of rows) {
    const values = columns.map(column => row[column]);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

    await client.query(
      `INSERT INTO "${table}" (${columnSql}) VALUES (${placeholders})`,
      values
    );
  }

  console.log(`${table}: imported ${rows.length} rows`);
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_DB_URL) {
    throw new Error(
      "DATABASE_URL or SUPABASE_DB_URL is missing. Check your local .env files."
    );
  }

  const local = makeClient(process.env.DATABASE_URL);
  const remote = makeClient(process.env.SUPABASE_DB_URL, {
    ca,
    rejectUnauthorized: true
  });

  await local.connect();

  try {
    const data = {};

    for (const table of tables) {
      data[table] = await getRows(local, table);
      console.log(`Local ${table}: ${data[table].length} rows`);
    }

    const expected = {
      trip_categories: 5,
      destinations: 13,
      special_trips: 3,
      customer_reviews: 2,
      enquiries: 11
    };

    for (const table of tables) {
      if (data[table].length !== expected[table]) {
        throw new Error(
          `Unexpected row count in ${table}. Expected ${expected[table]}, found ${data[table].length}. No migration performed.`
        );
      }
    }

    await remote.connect();

    try {
      await remote.query("BEGIN");

      // Delete children before parents.
      for (const table of [
        "enquiries",
        "customer_reviews",
        "special_trips",
        "destinations",
        "trip_categories"
      ]) {
        await remote.query(`DELETE FROM "${table}"`);
      }

      // Insert parents before children.
      for (const table of tables) {
        await insertRows(remote, table, data[table]);
      }

      // Verify imported row counts before committing.
      for (const table of tables) {
        const result = await remote.query(
          `SELECT COUNT(*)::int AS count FROM "${table}"`
        );

        if (result.rows[0].count !== expected[table]) {
          throw new Error(`Verification failed for ${table}`);
        }
      }

      await remote.query("COMMIT");
      console.log("Migration completed and verified.");
    } catch (error) {
      await remote.query("ROLLBACK");
      throw error;
    } finally {
      await remote.end();
    }
  } finally {
    await local.end();
  }
}

main().catch(error => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
