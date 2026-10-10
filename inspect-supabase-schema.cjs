
require("dotenv").config({
  path: ".env.supabase",
  quiet: true
});

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is missing");
  }

  const caPath = path.join(
    __dirname,
    "certs",
    "supabase-prod-ca-2021.crt"
  );

  const ca = fs.readFileSync(caPath, "utf8");

  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      ca,
      rejectUnauthorized: true
    }
  });

  await client.connect();

  try {
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'trip_categories',
          'destinations',
          'special_trips',
          'customer_reviews',
          'enquiries'
        )
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log("Verified Supabase connection.");
    console.log("Tables found:");

    for (const row of result.rows) {
      console.log("- " + row.table_name);
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error("Connection check failed:", error.message);
  process.exitCode = 1;
});
