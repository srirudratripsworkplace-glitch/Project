
require("dotenv").config({ path: ".env.supabase", quiet: true });
const { Client } = require("pg");

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is missing from .env.supabase");
  }

  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    );

    for (const row of result.rows) {
      const table = '"' + row.table_name.replace(/"/g, '""') + '"';
      const count = await client.query(
        'SELECT COUNT(*)::int AS count FROM public.' + table
      );
      console.log(row.table_name + ': ' + count.rows[0].count + ' rows');
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error("Supabase check failed:", error.message);
  process.exitCode = 1;
});
