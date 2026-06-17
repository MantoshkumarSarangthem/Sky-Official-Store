import pool from "./db";

export async function insertNotification(
  clerkUserId: string | null,
  type: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO user_notifications (clerk_user_id, type, title, body)
       VALUES ($1, $2, $3, $4)`,
      [clerkUserId, type, title, body]
    );
  } catch (err: any) {
    console.error("[notifications] insertNotification failed:", err?.message);
  }
}
