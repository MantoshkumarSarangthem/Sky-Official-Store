export interface RechargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  shouldRetry?: boolean;
}

export interface IRechargeProvider {
  readonly name: string;
  readonly isAutomatic: boolean;

  processRecharge(opts: {
    orderId: number;
    displayId: string;
    gameUserId: string;
    gameServerId: string;
    diamonds: number;
    packageId?: number;
    metadata?: Record<string, string>;
  }): Promise<RechargeResult>;
}
