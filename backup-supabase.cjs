
require("dotenv").config({
  path: ".env.supabase",
  quiet: true
});

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("Supabase connection is not configured.");
  }

  const backupDir = path.join(__dirname, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const backupFile = path.join(
    backupDir,
    "supabase-before-migration.dump"
  );

  const result = spawnSync(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--dbname",
      process.env.SUPABASE_DB_URL,
      "--file",
      backupFile
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PGSSLMODE: "verify-full",
        PGSSLROOTCERT: path.join(
          __dirname,
          "certs",
          "supabase-prod-ca-2021.crt"
        )
      }
    }
  );

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(result.stderr || "pg_dump failed.");
  }

  const info = fs.statSync(backupFile);
  console.log("Supabase backup created successfully.");
  console.log("File: " + backupFile);
  console.log("Size: " + info.size + " bytes");
}

main().catch(error => {
  console.error("Backup failed:", error.message);
  process.exitCode = 1;
});
