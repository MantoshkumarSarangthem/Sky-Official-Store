export interface PaymentVerifyResult {
  verified: boolean;
  transactionId?: string;
  paidAmount?: number;
  error?: string;
}

export interface IPaymentProvider {
  readonly name: string;
  readonly isAutomatic: boolean;

  verifyPayment(opts: {
    orderId: number;
    displayId: string;
    expectedAmount: number;
    upiRef?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentVerifyResult>;
}
