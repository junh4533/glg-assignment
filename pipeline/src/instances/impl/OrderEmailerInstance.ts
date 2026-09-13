import { promises as fs } from "fs";

import { QueueInstance } from "../classes/QueueInstance";
import { OrderMessage } from "../../definitions/messages/OrderMessage";
import { OrdersDatabase } from "../../databases/OrdersDatabase";
import { OrderStatus } from "../../definitions/enums/OrderStatus";
import { EmailService } from "../../services/email/EmailService";

const { SQS_ORDER_EMAIL_QUEUE_NAME } = process.env;

export class OrderEmailerInstance extends QueueInstance<OrderMessage> {
  constructor() {
    super({ loggerPrefix: "OrderEmailerInstance", queueName: SQS_ORDER_EMAIL_QUEUE_NAME });
  }

  protected getRequiredMessageFields(): Array<keyof OrderMessage> {
    return ["orderId"];
  }

  /**
   * Email the customer with the order details and receipt.
   * @param message
   * @protected
   */
  protected async process({ orderId }: OrderMessage): Promise<void> {
    const order = await OrdersDatabase.getOrderById(orderId);

    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (order.status === OrderStatus.CANCELLED) {
      await EmailService.sendEmail({ order });
      this.logger.info(`Order ${orderId} cancellation email sent`);
      return;
    }
    if (order.status !== OrderStatus.PROCESSING) {
      this.logger.warn(`Order ${orderId} is not in PROCESSING state`);
      return;
    }

    if (!order.receiptFilePath) {
      this.logger.warn(`Order ${orderId} does not have a receipt file path`);
      return;
    }

    // Read the receipt file into a buffer
    const receipt = await fs.readFile(order.receiptFilePath);
    await EmailService.sendEmail({
      order,
      receipt,
    });

    this.logger.info(`Order ${orderId} email sent`);

    await OrdersDatabase.update(order.orderId, { status: OrderStatus.COMPLETED, completedAt: Date.now() });
    await fs.unlink(order.receiptFilePath);
    
    this.logger.info(`Order ${orderId} status updated`);
  }
}
