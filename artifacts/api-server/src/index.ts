import app from "./app";
import pool from "./lib/db";
import { logger } from "./lib/logger";

async function initDb() {
  // Step 1: Create all tables first (safe on both fresh and existing DBs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id SERIAL PRIMARY KEY,
      diamonds INT NOT NULL,
      bonus_diamonds INT NOT NULL DEFAULT 0,
      price NUMERIC(10,2) NOT NULL,
      label TEXT,
      name TEXT,
      category TEXT,
      is_popular BOOLEAN DEFAULT FALSE,
      sort_order INT DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      clerk_user_id TEXT,
      package_id INT,
      diamonds INT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      mlbb_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallets (
      clerk_user_id TEXT PRIMARY KEY,
      balance NUMERIC(10,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      clerk_user_id TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      upi_ref TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mlbb_accounts (
      clerk_user_id TEXT PRIMARY KEY,
      mlbb_user_id TEXT NOT NULL,
      mlbb_server_id TEXT NOT NULL,
      mlbb_ign TEXT NOT NULL,
      verified_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recharge_staff (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      qr_image TEXT,
      whatsapp TEXT,
      status TEXT DEFAULT 'offline',
      shift_hours TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_inquiries (
      id SERIAL PRIMARY KEY,
      user_email TEXT,
      user_name TEXT,
      inquiry_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      image TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_notifications (
      id SERIAL PRIMARY KEY,
      clerk_user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Step 2: Add columns that may be missing on older installs (all tables exist by now)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='clerk_user_id') THEN
        ALTER TABLE orders ADD COLUMN clerk_user_id TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='bonus_diamonds') THEN
        ALTER TABLE packages ADD COLUMN bonus_diamonds INT NOT NULL DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='name') THEN
        ALTER TABLE packages ADD COLUMN name TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='category') THEN
        ALTER TABLE packages ADD COLUMN category TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='mlbb_server_id') THEN
        ALTER TABLE orders ADD COLUMN mlbb_server_id TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='mlbb_ign') THEN
        ALTER TABLE orders ADD COLUMN mlbb_ign TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='is_for_friend') THEN
        ALTER TABLE orders ADD COLUMN is_for_friend BOOLEAN DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='status') THEN
        ALTER TABLE packages ADD COLUMN status TEXT DEFAULT 'available';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='display_id') THEN
        ALTER TABLE orders ADD COLUMN display_id TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_staff_id') THEN
        ALTER TABLE orders ADD COLUMN assigned_staff_id INT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='completed_at') THEN
        ALTER TABLE orders ADD COLUMN completed_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recharge_staff' AND column_name='staff_pin') THEN
        ALTER TABLE recharge_staff ADD COLUMN staff_pin TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recharge_staff' AND column_name='notify_orders') THEN
        ALTER TABLE recharge_staff ADD COLUMN notify_orders BOOLEAN DEFAULT TRUE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recharge_staff' AND column_name='upi_id') THEN
        ALTER TABLE recharge_staff ADD COLUMN upi_id TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='game_id') THEN
        ALTER TABLE packages ADD COLUMN game_id INT REFERENCES games(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='image') THEN
        ALTER TABLE packages ADD COLUMN image TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='old_price') THEN
        ALTER TABLE packages ADD COLUMN old_price NUMERIC(10,2);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='region') THEN
        ALTER TABLE games ADD COLUMN region TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='currency_label') THEN
        ALTER TABLE packages ADD COLUMN currency_label TEXT;
      END IF;
    END$$;
  `);
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

initDb()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize DB");
    process.exit(1);
  });
