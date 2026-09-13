import nodemailer from 'nodemailer';
import { Order } from "../../definitions/entities/Order";
import { OrderStatus } from "../../definitions/enums/OrderStatus";

interface EmailParameters {
  order: Order;
  receipt?: Buffer;
}

const { SMTP_HOST, SMTP_PORT } = process.env;

export class EmailService {
  private static getBody(order: Order): string {
    if (order.status === OrderStatus.CANCELLED) {
      return `Dear ${order.details?.customer.name},
        Your order ${order.orderId} has been cancelled.

        Best regards,
        Your Company`;
    }

    return `Dear ${order.details?.customer.name},
      Thank you for your purchase! Please find your receipt attached.
      
      Best regards,
      Your Company`;
  }

  public static async sendEmail({ order, receipt }: EmailParameters): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: false,
    });

    const mailOptions = {
      from: '"Your Company" <no-reply@yourcompany.com>',
      to: order.details?.customer.email,
      subject: order.status === OrderStatus.CANCELLED
        ? `Order ${order.orderId} cancelled`
        : `Receipt for Order ${order.orderId}`,
      text: this.getBody(order),
      attachments: receipt
        ? [
            {
              filename: `receipt_${order.orderId}.pdf`,
              content: receipt,
              contentType: 'application/pdf',
            },
          ]
        : [],
    };

    await transporter.sendMail(mailOptions);
  }
}
