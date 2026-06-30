import pool from "../lib/db";
import type { PoolClient } from "pg";

export async function assignAvailableStaff(client?: PoolClient): Promise<number | null> {
  const db = client ?? pool;

  const { rows: staffList } = await db.query(
    `SELECT id FROM recharge_staff WHERE status = 'available' ORDER BY sort_order ASC, id ASC`
  );
  if (staffList.length === 0) return null;

  await db.query(
    `INSERT INTO settings (key, value) VALUES ('staff_rr_idx', '0') ON CONFLICT (key) DO NOTHING`
  );
  const { rows: idxRows } = await db.query(
    `SELECT value FROM settings WHERE key = 'staff_rr_idx'`
  );
  const currentIdx = parseInt(idxRows[0]?.value ?? "0");
  const assignedIdx = currentIdx % staffList.length;
  await db.query(
    `UPDATE settings SET value = $1 WHERE key = 'staff_rr_idx'`,
    [(assignedIdx + 1).toString()]
  );

  return staffList[assignedIdx].id;
}

export async function peekNextStaff(): Promise<{
  id: number;
  qr_image: string | null;
  upi_id: string | null;
  whatsapp: string | null;
} | null> {
  const { rows: staffList } = await pool.query(
    `SELECT id, qr_image, whatsapp, upi_id FROM recharge_staff WHERE status = 'available' ORDER BY sort_order ASC, id ASC`
  );
  if (staffList.length === 0) return null;

  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('staff_rr_idx', '0') ON CONFLICT (key) DO NOTHING`
  );
  const { rows: idxRows } = await pool.query(
    `SELECT value FROM settings WHERE key = 'staff_rr_idx'`
  );
  const currentIdx = parseInt(idxRows[0]?.value ?? "0");
  const peekIdx = currentIdx % staffList.length;
  return staffList[peekIdx] ?? null;
}
