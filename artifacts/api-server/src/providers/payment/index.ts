import type { IPaymentProvider } from "./IPaymentProvider";
import { ManualPaymentProvider } from "./manualPaymentProvider";

export function getPaymentProvider(): IPaymentProvider {
  const providerName = process.env.PAYMENT_PROVIDER?.toLowerCase();
  const apiKey = process.env.PAYMENT_API_KEY;
  const apiBaseUrl = process.env.PAYMENT_API_BASE_URL;

  if (providerName && apiKey && apiBaseUrl) {
    // To add a new provider later, implement IPaymentProvider and add it here:
    // if (providerName === "razorpay") return new RazorpayProvider(apiKey, apiBaseUrl);
    // if (providerName === "smspay")   return new SmspayProvider(apiKey, apiBaseUrl);
    console.warn(`[payment] Provider "${providerName}" is configured but not yet implemented. Falling back to manual.`);
  }

  return new ManualPaymentProvider();
}

export type { IPaymentProvider } from "./IPaymentProvider";
