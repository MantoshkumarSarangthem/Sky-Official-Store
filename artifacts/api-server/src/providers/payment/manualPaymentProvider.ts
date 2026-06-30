import type { IPaymentProvider, PaymentVerifyResult } from "./IPaymentProvider";

export class ManualPaymentProvider implements IPaymentProvider {
  readonly name = "manual";
  readonly isAutomatic = false;

  async verifyPayment(_opts: {
    orderId: number;
    displayId: string;
    expectedAmount: number;
    upiRef?: string;
  }): Promise<PaymentVerifyResult> {
    return {
      verified: false,
      error: "manual_confirmation_required",
    };
  }
}
