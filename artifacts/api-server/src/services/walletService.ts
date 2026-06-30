import pool from "../lib/db";
import type { PoolClient } from "pg";

type DbClient = PoolClient | typeof pool;

export async function creditWallet(
  clerkUserId: string,
  amount: number,
  description: string,
  refId?: string,
  client?: PoolClient
): Promise<void> {
  const db: DbClient = client ?? pool;

  await db.query(
    `INSERT INTO wallet_ledger (clerk_user_id, type, amount, description, ref_id)
     VALUES ($1, 'credit', $2, $3, $4)`,
    [clerkUserId, amount.toFixed(2), description, refId ?? null]
  );

  await db.query(
    `INSERT INTO wallets (clerk_user_id, balance, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (clerk_user_id)
     DO UPDATE SET balance = wallets.balance + $2, updated_at = NOW()`,
    [clerkUserId, amount.toFixed(2)]
  );

  // Mirror to wallet_transactions for backward compatibility
  await db.query(
    `INSERT INTO wallet_transactions (clerk_user_id, amount, type, status, upi_ref, description)
     VALUES ($1, $2, 'credit', 'approved', $3, $4)`,
    [clerkUserId, amount.toFixed(2), refId ?? null, description]
  );
}

export async function debitWallet(
  clerkUserId: string,
  amount: number,
  description: string,
  refId?: string,
  client?: PoolClient
): Promise<{ ok: boolean; error?: string }> {
  const db: DbClient = client ?? pool;

  const { rows } = await db.query(
    `SELECT balance FROM wallets WHERE clerk_user_id = $1 FOR UPDATE`,
    [clerkUserId]
  );
  const balance = parseFloat(rows[0]?.balance ?? "0");

  if (balance < amount) {
    return {
      ok: false,
      error: `Insufficient balance. You have ₹${balance.toFixed(0)}, need ₹${amount.toFixed(0)}.`,
    };
  }

  await db.query(
    `INSERT INTO wallet_ledger (clerk_user_id, type, amount, description, ref_id)
     VALUES ($1, 'debit', $2, $3, $4)`,
    [clerkUserId, amount.toFixed(2), description, refId ?? null]
  );

  await db.query(
    `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE clerk_user_id = $2`,
    [amount.toFixed(2), clerkUserId]
  );

  await db.query(
    `INSERT INTO wallet_transactions (clerk_user_id, amount, type, status, upi_ref, description)
     VALUES ($1, $2, 'debit', 'approved', $3, $4)`,
    [clerkUserId, amount.toFixed(2), refId ?? null, description]
  );

  return { ok: true };
}

export async function getBalance(clerkUserId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT balance FROM wallets WHERE clerk_user_id = $1`,
    [clerkUserId]
  );
  return parseFloat(rows[0]?.balance ?? "0");
}

export async function getLedger(
  clerkUserId: string,
  limit = 50
): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM wallet_ledger WHERE clerk_user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [clerkUserId, limit]
  );
  return rows;
}

export async function adminDirectCredit(
  clerkUserId: string,
  amount: number,
  note: string,
  actor: string
): Promise<{ ok: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await creditWallet(clerkUserId, amount, `Admin credit: ${note}`, `admin:${actor}`, client);
    await client.query("COMMIT");
    return { ok: true };
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function adminDirectDebit(
  clerkUserId: string,
  amount: number,
  note: string,
  actor: string
): Promise<{ ok: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await debitWallet(clerkUserId, amount, `Admin debit: ${note}`, `admin:${actor}`, client);
    if (!result.ok) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function approveTopup(
  txId: number
): Promise<{ ok: boolean; error?: string; tx?: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM wallet_transactions WHERE id = $1 AND status = 'pending' AND type = 'credit'`,
      [txId]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Not found or already processed" };
    }
    const tx = rows[0];

    await creditWallet(
      tx.clerk_user_id,
      parseFloat(tx.amount),
      `Wallet top-up approved (ref: ${tx.upi_ref ?? txId})`,
      String(txId),
      client
    );

    await client.query(
      `UPDATE wallet_transactions SET status = 'approved' WHERE id = $1`,
      [txId]
    );

    await client.query("COMMIT");
    return { ok: true, tx };
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function rejectTopup(
  txId: number
): Promise<{ ok: boolean; error?: string; tx?: any }> {
  const { rows } = await pool.query(
    `SELECT * FROM wallet_transactions WHERE id = $1 AND status = 'pending'`,
    [txId]
  );
  const tx = rows[0];

  const { rowCount } = await pool.query(
    `UPDATE wallet_transactions SET status = 'rejected' WHERE id = $1 AND status = 'pending'`,
    [txId]
  );
  if (!rowCount) return { ok: false, error: "Not found or already processed" };
  return { ok: true, tx };
}
