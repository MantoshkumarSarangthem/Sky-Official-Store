import { sendPushToAll } from "../routes/push";
import { insertNotification } from "../lib/notifications";

export async function notifyNewOrder(opts: {
  displayId: string;
  diamonds: number;
  price: string;
}): Promise<void> {
  const diamonds = Number(opts.diamonds).toLocaleString("en-IN");
  const price = parseFloat(opts.price).toFixed(0);
  sendPushToAll({
    title: "New Order",
    body: `${opts.displayId} · ${diamonds} diamonds · ₹${price}`,
    tag: "new-order",
    url: "/staff",
    icon: "/icon-notif.png",
  });
}

export async function notifyCartOrder(opts: {
  itemCount: number;
  totalPrice: number;
}): Promise<void> {
  sendPushToAll({
    title: "🛒 Cart Order!",
    body: `${opts.itemCount} items · ₹${opts.totalPrice.toFixed(0)}`,
    tag: "new-order",
    url: "/admin",
    icon: "/icon-notif.png",
  });
}

export async function notifyPaymentConfirmed(
  clerkUserId: string,
  displayId: string,
  amount: string
): Promise<void> {
  await insertNotification(
    clerkUserId,
    "payment_confirmed",
    "Payment Confirmed ✅",
    `Your payment of ₹${parseFloat(amount).toFixed(0)} for order ${displayId} has been confirmed. Your order is now being processed.`
  );
}

export async function notifyOrderCompleted(
  clerkUserId: string,
  displayId: string,
  diamonds: number
): Promise<void> {
  const diamondStr = Number(diamonds).toLocaleString("en-IN");
  await insertNotification(
    clerkUserId,
    "order_completed",
    "Order Delivered ✅",
    `Your order ${displayId} (${diamondStr} diamonds) has been delivered to your account.`
  );
}

export async function notifyAutoProcessSuccess(
  clerkUserId: string,
  displayId: string,
  diamonds: number
): Promise<void> {
  const diamondStr = Number(diamonds).toLocaleString("en-IN");
  await insertNotification(
    clerkUserId,
    "order_completed",
    "Order Auto-Processed ✅",
    `Your order ${displayId} (${diamondStr} diamonds) was delivered automatically.`
  );
}

export async function notifyOrderFailed(
  clerkUserId: string,
  displayId: string,
  reason?: string
): Promise<void> {
  await insertNotification(
    clerkUserId,
    "payment_failed",
    "Order Issue ⚠️",
    `There was an issue with order ${displayId}${reason ? `: ${reason}` : ""}. Please contact support.`
  );
}

export async function notifyWalletDebited(
  clerkUserId: string,
  amount: number,
  pkgName: string,
  displayId: string
): Promise<void> {
  await insertNotification(
    clerkUserId,
    "wallet_deducted",
    `Wallet Deducted -₹${amount.toFixed(0)}`,
    `₹${amount.toFixed(0)} deducted from your wallet for "${pkgName}". Order ID: ${displayId}.`
  );
}

export async function notifyWalletApproved(
  clerkUserId: string,
  amount: number
): Promise<void> {
  await insertNotification(
    clerkUserId,
    "wallet_approved",
    "Wallet Topped Up ✅",
    `Your top-up request of ₹${amount.toFixed(0)} has been approved and added to your wallet.`
  );
}

export async function notifyWalletRejected(
  clerkUserId: string,
  amount: number
): Promise<void> {
  await insertNotification(
    clerkUserId,
    "wallet_rejected",
    "Top-up Request Rejected",
    `Your wallet top-up request of ₹${amount.toFixed(0)} was not approved. Please contact support.`
  );
}

export function notifyStaffNewOrder(displayId: string, reason: string): void {
  sendPushToAll({
    title: "⚡ Order Needs Staff",
    body: `${displayId} — ${reason}`,
    tag: "staff-new-order",
    url: "/staff",
    icon: "/icon-notif.png",
  });
}

export function notifyWalletTopup(amount: number, requestId: string): void {
  sendPushToAll({
    title: "💰 Wallet Top-up Request!",
    body: `₹${amount.toFixed(0)} · ${requestId}`,
    tag: "wallet-topup",
    url: "/admin?tab=wallet",
    icon: "/icon-notif.png",
  });
}
