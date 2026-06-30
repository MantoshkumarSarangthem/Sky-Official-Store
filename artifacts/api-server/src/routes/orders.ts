import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";
import * as orderService from "../services/orderService";
import * as walletService from "../services/walletService";
import * as notif from "../services/notificationService";
import { assignAvailableStaff } from "../services/staffService";

const router = Router();

interface OfferResult {
  offerId: number;
  offerPrice: string;
  eligibility: string;
}

async function resolveOffer(
  client: { query: (...args: any[]) => Promise<any> },
  offerId: number,
  packageId: number,
  clerkUserId: string
): Promise<OfferResult | null> {
  const { rows } = await client.query(
    `SELECT o.id, o.eligibility, o.max_claims, o.total_claims, o.is_active, op.offer_price
     FROM offers o
     JOIN offer_packages op ON op.offer_id = o.id AND op.package_id = $2
     WHERE o.id = $1`,
    [offerId, packageId]
  );
  if (!rows[0]) return null;
  const offer = rows[0];
  if (!offer.is_active) return null;
  if (offer.max_claims !== null && parseInt(offer.total_claims) >= offer.max_claims) return null;

  if (offer.eligibility === "first_time") {
    const { rows: prevOrders } = await client.query(
      "SELECT 1 FROM orders WHERE clerk_user_id = $1 AND status != 'cancelled' LIMIT 1",
      [clerkUserId]
    );
    if (prevOrders.length > 0) return null;
    const { rows: claimed } = await client.query(
      "SELECT 1 FROM claimed_offers WHERE offer_id = $1 AND user_id = $2",
      [offerId, clerkUserId]
    );
    if (claimed.length > 0) return null;
  } else if (offer.eligibility === "all_once") {
    const { rows: claimed } = await client.query(
      "SELECT 1 FROM claimed_offers WHERE offer_id = $1 AND user_id = $2",
      [offerId, clerkUserId]
    );
    if (claimed.length > 0) return null;
  }

  return { offerId, offerPrice: parseFloat(offer.offer_price).toFixed(2), eligibility: offer.eligibility };
}

async function recordOfferClaim(
  client: { query: (...args: any[]) => Promise<any> },
  offerId: number,
  userId: string,
  eligibility: string
) {
  if (eligibility !== "unlimited") {
    await client.query(
      "INSERT INTO claimed_offers (offer_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [offerId, userId]
    );
  }
  await client.query(
    "UPDATE offers SET total_claims = total_claims + 1 WHERE id = $1",
    [offerId]
  );
}

router.get("/my", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      `SELECT o.*, p.image AS pack_image, p.name AS pack_name, g.name AS game_name
       FROM orders o
       LEFT JOIN packages p ON o.package_id = p.id
       LEFT JOIN games g ON p.game_id = g.id
       WHERE o.clerk_user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error("[orders] GET /my failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/:id/events", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  const orderId = parseInt(req.params.id);
  try {
    const { rows: orders } = await pool.query(
      "SELECT id FROM orders WHERE id = $1 AND clerk_user_id = $2",
      [orderId, userId]
    );
    if (!orders[0]) { res.status(404).json({ error: "Order not found" }); return; }
    const events = await orderService.getOrderEvents(orderId);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/", requireAuth, async (req: any, res): Promise<void> => {
  const clerkUserId = req.clerkUserId as string;
  const { packageId, refId, remark, mlbbUserId, mlbbServerId, mlbbIgn, isForFriend, offerId } = req.body;

  if (!packageId) {
    res.status(400).json({ ok: false, error: "packageId is required." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: pkgs } = await client.query(
      "SELECT id, diamonds, price FROM packages WHERE id = $1",
      [packageId]
    );
    if (!pkgs[0]) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, error: "Package not found." });
      return;
    }
    const pkg = pkgs[0];

    let finalPrice = pkg.price;
    let appliedOffer: OfferResult | null = null;
    if (offerId) {
      appliedOffer = await resolveOffer(client, parseInt(offerId), pkg.id, clerkUserId);
      if (!appliedOffer) {
        await client.query("ROLLBACK");
        res.status(400).json({ ok: false, error: "This offer is no longer available or you have already used it." });
        return;
      }
      finalPrice = appliedOffer.offerPrice;
    }

    let mlbbId = mlbbUserId || null;
    let serverId = mlbbServerId || null;
    let ign = mlbbIgn || null;
    if (!mlbbId) {
      const { rows: accounts } = await client.query(
        "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign FROM mlbb_accounts WHERE clerk_user_id = $1",
        [clerkUserId]
      );
      if (accounts[0]) { mlbbId = accounts[0].mlbb_user_id; serverId = accounts[0].mlbb_server_id; ign = accounts[0].mlbb_ign; }
    }

    const noteBase = remark ? `Ref: ${remark}` : refId ? `Ref: ${refId}` : null;
    const friendNote = isForFriend ? " [For Friend]" : "";
    const note = noteBase ? noteBase + friendNote : friendNote || null;

    const displayId = await orderService.getNextDisplayId(client);

    const { rows: inserted } = await client.query(
      `INSERT INTO orders (clerk_user_id, package_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign,
                           is_for_friend, status, note, display_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment',$9,$10) RETURNING id`,
      [clerkUserId, pkg.id, pkg.diamonds, finalPrice, mlbbId, serverId, ign, isForFriend || false, note, displayId]
    );
    const orderId = inserted[0].id;

    await orderService.logOrderEvent(orderId, "created", "pending_payment", "system:order_create", "Order created — awaiting payment", client);

    if (appliedOffer) {
      await recordOfferClaim(client, appliedOffer.offerId, clerkUserId, appliedOffer.eligibility);
    }

    await client.query("COMMIT");

    res.json({ ok: true, id: orderId, displayId });

    notif.notifyNewOrder({ displayId, diamonds: pkg.diamonds, price: finalPrice });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[orders] POST / failed:", err?.message, err?.stack);
    res.status(500).json({ ok: false, error: "DB error. Please try again." });
  } finally {
    client.release();
  }
});

router.post("/cart", requireAuth, async (req: any, res): Promise<void> => {
  const clerkUserId = req.clerkUserId as string;
  const { items, refId, remark, mlbbUserId, mlbbServerId, mlbbIgn, isForFriend } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ ok: false, error: "items array is required." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let mlbbId = mlbbUserId || null;
    let serverId = mlbbServerId || null;
    let ign = mlbbIgn || null;
    if (!mlbbId) {
      const { rows: accounts } = await client.query(
        "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign FROM mlbb_accounts WHERE clerk_user_id = $1",
        [clerkUserId]
      );
      if (accounts[0]) { mlbbId = accounts[0].mlbb_user_id; serverId = accounts[0].mlbb_server_id; ign = accounts[0].mlbb_ign; }
    }

    const noteBase = remark ? `Ref: ${remark}` : refId ? `Ref: ${refId}` : null;
    const friendNote = isForFriend ? " [For Friend]" : "";
    const orderIds: number[] = [];
    const displayIds: string[] = [];
    let totalPrice = 0;

    for (const item of items) {
      const { packageId, quantity = 1, offerId: itemOfferId } = item;
      const { rows: pkgs } = await client.query(
        "SELECT id, diamonds, price FROM packages WHERE id = $1", [packageId]
      );
      if (!pkgs[0]) continue;
      const pkg = pkgs[0];

      let finalPrice = pkg.price;
      let appliedOffer: OfferResult | null = null;
      if (itemOfferId) {
        appliedOffer = await resolveOffer(client, parseInt(itemOfferId), pkg.id, clerkUserId);
        if (appliedOffer) finalPrice = appliedOffer.offerPrice;
      }

      for (let q = 0; q < quantity; q++) {
        const note = noteBase ? noteBase + friendNote : friendNote || null;
        const displayId = await orderService.getNextDisplayId(client);
        const { rows: inserted } = await client.query(
          `INSERT INTO orders (clerk_user_id, package_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign,
                               is_for_friend, status, note, display_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment',$9,$10) RETURNING id`,
          [clerkUserId, pkg.id, pkg.diamonds, finalPrice, mlbbId, serverId, ign, isForFriend || false, note, displayId]
        );
        const orderId = inserted[0].id;
        await orderService.logOrderEvent(orderId, "created", "pending_payment", "system:cart_create", "Cart order created — awaiting payment", client);
        orderIds.push(orderId);
        displayIds.push(displayId);
        totalPrice += parseFloat(finalPrice);
      }

      if (appliedOffer) {
        await recordOfferClaim(client, appliedOffer.offerId, clerkUserId, appliedOffer.eligibility);
      }
    }

    await client.query("COMMIT");

    res.json({ ok: true, ids: orderIds, displayIds });

    notif.notifyCartOrder({ itemCount: orderIds.length, totalPrice });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[orders] POST /cart failed:", err?.message, err?.stack);
    res.status(500).json({ ok: false, error: "DB error. Please try again." });
  } finally {
    client.release();
  }
});

router.post("/wallet-pay", requireAuth, async (req: any, res): Promise<void> => {
  const clerkUserId = req.clerkUserId as string;
  const { packageId, mlbbUserId, mlbbServerId, mlbbIgn, isForFriend, offerId } = req.body;

  if (!packageId) {
    res.status(400).json({ ok: false, error: "packageId is required." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: pkgs } = await client.query(
      "SELECT id, diamonds, price, name FROM packages WHERE id = $1",
      [packageId]
    );
    if (!pkgs[0]) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, error: "Package not found." });
      return;
    }
    const pkg = pkgs[0];

    let finalPriceStr = pkg.price;
    let appliedOffer: OfferResult | null = null;
    if (offerId) {
      appliedOffer = await resolveOffer(client, parseInt(offerId), pkg.id, clerkUserId);
      if (!appliedOffer) {
        await client.query("ROLLBACK");
        res.status(400).json({ ok: false, error: "This offer is no longer available or you have already used it." });
        return;
      }
      finalPriceStr = appliedOffer.offerPrice;
    }

    const price = parseFloat(finalPriceStr);
    const pkgName = pkg.name || `${pkg.diamonds} Diamonds`;

    // Atomic wallet debit via walletService (includes ledger + balance update)
    const debitResult = await walletService.debitWallet(
      clerkUserId,
      price,
      `Diamond purchase: ${pkgName}`,
      undefined,
      client
    );
    if (!debitResult.ok) {
      await client.query("ROLLBACK");
      res.status(400).json({ ok: false, error: debitResult.error });
      return;
    }

    let mlbbId = mlbbUserId || null;
    let serverId = mlbbServerId || null;
    let ign = mlbbIgn || null;
    if (!mlbbId) {
      const { rows: accounts } = await client.query(
        "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign FROM mlbb_accounts WHERE clerk_user_id = $1",
        [clerkUserId]
      );
      if (accounts[0]) { mlbbId = accounts[0].mlbb_user_id; serverId = accounts[0].mlbb_server_id; ign = accounts[0].mlbb_ign; }
    }

    const displayId = await orderService.getNextDisplayId(client);
    const staffId = await assignAvailableStaff(client);

    const { rows: inserted } = await client.query(
      `INSERT INTO orders (clerk_user_id, package_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign,
                           is_for_friend, status, note, display_id, assigned_staff_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'payment_confirmed','Paid via wallet',$9,$10) RETURNING id`,
      [clerkUserId, pkg.id, pkg.diamonds, finalPriceStr, mlbbId, serverId, ign, isForFriend || false, displayId, staffId]
    );
    const orderId = inserted[0].id;

    await orderService.logOrderEvent(orderId, "created", "payment_confirmed", "system:wallet_pay", "Wallet payment — instant confirmation", client);

    if (appliedOffer) {
      await recordOfferClaim(client, appliedOffer.offerId, clerkUserId, appliedOffer.eligibility);
    }

    await client.query("COMMIT");

    res.json({ ok: true, id: orderId, displayId });

    // Fire notifications and trigger processing pipeline in background
    notif.notifyWalletDebited(clerkUserId, price, pkgName, displayId);
    notif.notifyNewOrder({ displayId, diamonds: pkg.diamonds, price: finalPriceStr });

    orderService.processAfterPayment(orderId).catch((err: any) => {
      console.error("[orders] processAfterPayment (wallet) failed:", err?.message);
    });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[orders] wallet-pay failed:", err?.message, err?.stack);
    res.status(500).json({ ok: false, error: "DB error. Please try again." });
  } finally {
    client.release();
  }
});

export default router;
