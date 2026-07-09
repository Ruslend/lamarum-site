import pg from "pg";
import { readFileSync } from "node:fs";

const { Pool } = pg;

let pool;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  if (!pool) {
    const ssl = buildSslConfig(process.env.DATABASE_URL);
    const poolConfig = {
      connectionString: ssl ? removeDatabaseUrlSslParams(process.env.DATABASE_URL) : process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 5,
      statement_timeout: 5000,
    };

    if (ssl) {
      poolConfig.ssl = ssl;
    }

    pool = new Pool(poolConfig);

    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error:", error.message);
    });
  }

  return pool;
}

function buildSslConfig(connectionString) {
  if (isSslVerificationDisabled()) {
    return { rejectUnauthorized: false };
  }

  if (process.env.PGSSLROOTCERT) {
    const certificate = readFileSync(process.env.PGSSLROOTCERT, "utf8");

    return {
      ca: certificate,
      rejectUnauthorized: true,
    };
  }

  if (databaseUrlRequiresSsl(connectionString)) {
    return { rejectUnauthorized: true };
  }

  return undefined;
}

function isSslVerificationDisabled() {
  return String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "")
    .trim()
    .toLowerCase() === "false";
}

function removeDatabaseUrlSslParams(connectionString) {
  try {
    const url = new URL(connectionString);

    for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      url.searchParams.delete(parameter);
    }

    return url.toString();
  } catch {
    return connectionString
      .replace(/([?&])sslmode=(?:require|verify-full|verify-ca|disable|prefer|allow)(?=&|$)/gi, "$1")
      .replace(/([?&])ssl(?:cert|key|rootcert)=[^&]*(?=&|$)/gi, "$1")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

function databaseUrlRequiresSsl(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");

    return sslmode === "require" || sslmode === "verify-full";
  } catch {
    return /[?&]sslmode=(require|verify-full)(?:&|$)/i.test(connectionString);
  }
}

export async function initializeDatabase() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const database = getPool();

  await database.query(`
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

  await database.query(`
    ALTER TABLE applications
      ADD COLUMN IF NOT EXISTS name VARCHAR(60),
      ADD COLUMN IF NOT EXISTS contact VARCHAR(80),
      ADD COLUMN IF NOT EXISTS grade VARCHAR(40),
      ADD COLUMN IF NOT EXISTS goal VARCHAR(1000),
      ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'new',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
  `);

  await database.query(`
    CREATE INDEX IF NOT EXISTS applications_created_at_idx
    ON applications (created_at DESC)
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS schedule_slots (
      id BIGSERIAL PRIMARY KEY,
      slot_date DATE NOT NULL,
      slot_time VARCHAR(5) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'available',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT schedule_slots_status_check CHECK (status IN ('available', 'booked')),
      CONSTRAINT schedule_slots_date_time_unique UNIQUE (slot_date, slot_time)
    )
  `);

  await database.query(`
    ALTER TABLE schedule_slots
      ADD COLUMN IF NOT EXISTS slot_date DATE,
      ADD COLUMN IF NOT EXISTS slot_time VARCHAR(5),
      ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'available',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
  `);

  await database.query(`
    CREATE INDEX IF NOT EXISTS schedule_slots_date_time_idx
    ON schedule_slots (slot_date ASC, slot_time ASC)
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS trial_bookings (
      id BIGSERIAL PRIMARY KEY,
      slot_id BIGINT REFERENCES schedule_slots(id) ON DELETE SET NULL,
      parent_name VARCHAR(80) NOT NULL,
      student_name VARCHAR(80) NOT NULL,
      grade VARCHAR(40) NOT NULL,
      contact VARCHAR(80) NOT NULL,
      goal VARCHAR(1000) NOT NULL DEFAULT '',
      comment VARCHAR(1000) NOT NULL DEFAULT '',
      slot_label VARCHAR(160) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await database.query(`
    ALTER TABLE trial_bookings
      ADD COLUMN IF NOT EXISTS slot_id BIGINT,
      ADD COLUMN IF NOT EXISTS parent_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS student_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS grade VARCHAR(40),
      ADD COLUMN IF NOT EXISTS contact VARCHAR(80),
      ADD COLUMN IF NOT EXISTS goal VARCHAR(1000) DEFAULT '',
      ADD COLUMN IF NOT EXISTS comment VARCHAR(1000) DEFAULT '',
      ADD COLUMN IF NOT EXISTS slot_label VARCHAR(160),
      ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'new',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
  `);

  await database.query(`
    CREATE INDEX IF NOT EXISTS trial_bookings_created_at_idx
    ON trial_bookings (created_at DESC)
  `);

  await seedInitialScheduleSlots(database);

  return true;
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

export async function listScheduleSlots() {
  const result = await getPool().query(`
    SELECT id, slot_date::text AS slot_date, slot_time, status, created_at
    FROM schedule_slots
    ORDER BY slot_date ASC, slot_time ASC
  `);

  return result.rows.map(mapScheduleSlot);
}

export async function createScheduleSlot({ date, time, status = "available" }) {
  const result = await getPool().query(
    `
      INSERT INTO schedule_slots (slot_date, slot_time, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (slot_date, slot_time)
      DO UPDATE SET status = EXCLUDED.status
      RETURNING id, slot_date::text AS slot_date, slot_time, status, created_at
    `,
    [date, time, status],
  );

  return mapScheduleSlot(result.rows[0]);
}

export async function deleteScheduleSlot(id) {
  await getPool().query("DELETE FROM schedule_slots WHERE id = $1", [id]);
}

export async function toggleScheduleSlotStatus(id) {
  const result = await getPool().query(
    `
      UPDATE schedule_slots
      SET status = CASE WHEN status = 'available' THEN 'booked' ELSE 'available' END
      WHERE id = $1
      RETURNING id, slot_date::text AS slot_date, slot_time, status, created_at
    `,
    [id],
  );

  return result.rows[0] ? mapScheduleSlot(result.rows[0]) : null;
}

export async function createTrialBooking(data) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const slotResult = await client.query(
      `
        SELECT id, slot_date::text AS slot_date, slot_time, status, created_at
        FROM schedule_slots
        WHERE id = $1
        FOR UPDATE
      `,
      [data.slotId],
    );

    const slot = slotResult.rows[0];

    if (!slot) {
      throw createBookingError("SLOT_NOT_FOUND", "Выбранный слот не найден.");
    }

    if (slot.status !== "available") {
      throw createBookingError("SLOT_UNAVAILABLE", "Выбранный слот уже занят.");
    }

    const slotLabel = buildSlotLabel(mapScheduleSlot(slot));
    const bookingResult = await client.query(
      `
        INSERT INTO trial_bookings (
          slot_id,
          parent_name,
          student_name,
          grade,
          contact,
          goal,
          comment,
          slot_label
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          slot_id,
          parent_name,
          student_name,
          grade,
          contact,
          goal,
          comment,
          slot_label,
          status,
          created_at
      `,
      [
        data.slotId,
        data.parentName,
        data.studentName,
        data.grade,
        data.contact,
        data.goal,
        data.comment,
        slotLabel,
      ],
    );

    await client.query("UPDATE schedule_slots SET status = 'booked' WHERE id = $1", [data.slotId]);
    await client.query("COMMIT");

    return mapTrialBooking(bookingResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listTrialBookings(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const result = await getPool().query(
    `
      SELECT
        id,
        slot_id,
        parent_name,
        student_name,
        grade,
        contact,
        goal,
        comment,
        slot_label,
        status,
        created_at
      FROM trial_bookings
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map(mapTrialBooking);
}

async function seedInitialScheduleSlots(database) {
  const result = await database.query("SELECT COUNT(*)::int AS count FROM schedule_slots");

  if (result.rows[0].count > 0) {
    return;
  }

  const slots = buildInitialScheduleSlots();

  for (const slot of slots) {
    await database.query(
      `
        INSERT INTO schedule_slots (slot_date, slot_time, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (slot_date, slot_time) DO NOTHING
      `,
      [slot.date, slot.time, slot.status],
    );
  }
}

function buildInitialScheduleSlots() {
  return [
    { date: addDaysIso(1), time: "18:00", status: "available" },
    { date: addDaysIso(3), time: "19:30", status: "available" },
    { date: addDaysIso(5), time: "17:00", status: "available" },
    { date: addDaysIso(8), time: "18:30", status: "available" },
    { date: addDaysIso(10), time: "20:00", status: "available" },
  ];
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalIsoDate(date);
}

export function mapScheduleSlot(row) {
  const date = normalizeDate(row.slot_date);
  const time = row.slot_time.slice(0, 5);
  const slot = {
    id: String(row.id),
    date,
    time,
    status: row.status,
    weekday: formatWeekday(date),
  };

  return {
    ...slot,
    label: buildSlotLabel(slot),
    created_at: row.created_at,
  };
}

function mapTrialBooking(row) {
  return {
    id: String(row.id),
    slot_id: row.slot_id ? String(row.slot_id) : "",
    parent_name: row.parent_name,
    student_name: row.student_name,
    grade: row.grade,
    contact: row.contact,
    goal: row.goal,
    comment: row.comment,
    slot_label: row.slot_label,
    status: row.status,
    created_at: row.created_at,
  };
}

function normalizeDate(value) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return formatLocalIsoDate(value);
  }

  return String(value).slice(0, 10);
}

function formatWeekday(date) {
  const plainDate = parsePlainDate(date);
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
  });
  const weekday = formatter.format(new Date(plainDate.year, plainDate.month - 1, plainDate.day, 12, 0, 0));

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function buildSlotLabel(slot) {
  const plainDate = parsePlainDate(slot.date);
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(new Date(plainDate.year, plainDate.month - 1, plainDate.day, 12, 0, 0));

  return `${slot.weekday}, ${date}, ${slot.time}`;
}

function parsePlainDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  return { year, month, day };
}

function formatLocalIsoDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createBookingError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
