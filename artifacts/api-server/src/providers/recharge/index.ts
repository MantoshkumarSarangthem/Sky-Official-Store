import type { IRechargeProvider } from "./IRechargeProvider";
import { StaffQueueProvider } from "./staffQueueProvider";

export function getRechargeProvider(): IRechargeProvider {
  const providerName = process.env.RECHARGE_PROVIDER?.toLowerCase();
  const apiKey = process.env.RECHARGE_API_KEY;
  const apiBaseUrl = process.env.RECHARGE_API_BASE_URL;

  if (providerName && apiKey && apiBaseUrl) {
    // To add a new provider later, implement IRechargeProvider and add it here:
    // if (providerName === "smile")     return new SmileProvider(apiKey, apiBaseUrl);
    // if (providerName === "codashop")  return new CodashopProvider(apiKey, apiBaseUrl);
    // if (providerName === "yokcash")   return new YokcashProvider(apiKey, apiBaseUrl);
    console.warn(`[recharge] Provider "${providerName}" is configured but not yet implemented. Falling back to staff queue.`);
  }

  return new StaffQueueProvider();
}

export type { IRechargeProvider } from "./IRechargeProvider";
