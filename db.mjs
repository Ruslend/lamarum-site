import pg from "pg";

const { Pool } = pg;

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 5,
      statement_timeout: 5000,
    });

    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error:", error.message);
    });
  }

  return pool;
}

export async function initializeDatabase() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS applications (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      contact VARCHAR(80) NOT NULL,
      grade VARCHAR(40) NOT NULL,
      goal VARCHAR(1000) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await getPool().query(`
    CREATE INDEX IF NOT EXISTS applications_created_at_idx
    ON applications (created_at DESC)
  `);
}

export async function createApplication({ name, contact, grade, goal }) {
  const result = await getPool().query(
    `
      INSERT INTO applications (name, contact, grade, goal)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, contact, grade, goal, status, created_at
    `,
    [name, contact, grade, goal],
  );

  return result.rows[0];
}

export async function listApplications(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const result = await getPool().query(
    `
      SELECT id, name, contact, grade, goal, status, created_at
      FROM applications
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows;
}
