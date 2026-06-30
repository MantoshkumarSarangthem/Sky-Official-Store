import type { IRechargeProvider, RechargeResult } from "./IRechargeProvider";

export class StaffQueueProvider implements IRechargeProvider {
  readonly name = "staff_queue";
  readonly isAutomatic = false;

  async processRecharge(_opts: {
    orderId: number;
    displayId: string;
    gameUserId: string;
    gameServerId: string;
    diamonds: number;
  }): Promise<RechargeResult> {
    return {
      success: false,
      error: "staff_processing_required",
    };
  }
}
