**Retail Flow – Delivery and Late-Order Policy for AI Order Exception Agent**  
Effective: 2026-01-01 | Policy ID: DEL-POL-1.0

**DEL-01** This policy applies to all orders on retailflow.com.

**DEL-02** Observable fields: `purchase_date`, `estimated_delivery_date` (EDD), `ship_date`, `delivery_date`, `last_scan_date`, `order_status`, `delivery_attempts`, `tracking_status`. Order statuses: Processing, Shipped, In Transit, Out for Delivery, Delivered, Delivery Exception, Returned to Sender.

**DEL-03** Expected delivery date: use `estimated_delivery_date` shown at checkout. If null, EDD = `ship_date` + 7 calendar days for standard shipping, or `ship_date` + 3 calendar days for expedited shipping.

**DEL-04** If `order_status` = Processing and `current_date` <= `purchase_date` + 2 business days, the AI must inform the customer that the order is preparing.

**DEL-05** If `ship_date` is null and `current_date` > `purchase_date` + 3 business days, the AI must offer cancellation with a full refund. If the customer accepts, process under REF-08. If `current_date` > `purchase_date` + 7 business days, the AI must escalate to a human agent.

**DEL-06** A delivery is late if `delivery_date` is null and `current_date` > EDD. `days_late` = `current_date` − EDD.

**DEL-07** If `days_late` = 1–3, the AI must inform the customer of the delay. No compensation is issued.

**DEL-08** If `days_late` = 4–7, the AI must issue a $5 store credit when the customer requests it. No refund is issued.

**DEL-09** If `days_late` > 7, the AI must refund the original shipping cost if shipping was paid. If shipping was free, the AI must issue a $10 store credit. The customer may cancel for a full refund if the order is not delivered. If delivered later, only the shipping refund or store credit applies.

**DEL-10** If `order_status` = Delivered and `delivery_date` > EDD, apply DEL-07, DEL-08, or DEL-09 based on `delivery_date` − EDD.

**DEL-11** Stuck in transit: if `order_status` = In Transit or Delivery Exception and `last_scan_date` <= `current_date` − 5 calendar days, the AI must open a carrier trace. If `last_scan_date` <= `current_date` − 10 calendar days, the AI must process a full refund when the customer requests it, or a replacement if the SKU is in stock. If refund > $500, escalate under REF-15.

**DEL-12** Marked delivered but missing: if `order_status` = Delivered and the customer reports non-receipt within 7 calendar days of `delivery_date`, the AI must require a photo of the delivery location. If carrier GPS shows delivery to the correct address, the AI must provide that information and ask the customer to wait 24 hours. If the customer reports again after 24 hours, or if no GPS data exists, the AI must process a replacement or refund. If the report is made after 7 calendar days, escalate.

**DEL-13** Failed delivery attempts: if `delivery_attempts` = 1, the AI must provide the carrier reschedule link. If `delivery_attempts` = 2, the AI must contact the carrier for redelivery. If `delivery_attempts` >= 3 or `order_status` = Returned to Sender, the AI must process a full refund when the package reaches the warehouse, or a replacement if the customer requests it and the SKU is in stock.

**DEL-14** Delivery address problems: if the carrier reports invalid or undeliverable address and `ship_date` is null, the AI must request a corrected address. If `ship_date` is not null, the AI must escalate to a human agent. If the correction changes the country, escalate.

**DEL-15** Information vs escalation: the AI provides information for DEL-04, DEL-07, and DEL-13 with 1 attempt. The AI processes compensation for DEL-08, DEL-09, DEL-11 when refund <= $500, and DEL-12 when within 7 days and no GPS proof. The AI escalates for DEL-05 after 7 business days, DEL-11 refunds > $500, DEL-12 after 7 days, DEL-14 after shipment, and any fraud flag.

**DEL-16** Compensation and refunds: store credit for DEL-08 and DEL-09 free shipping. Shipping refund for DEL-09. Full refund for DEL-05 cancellation, DEL-11 after 10 days, DEL-12 approved, and DEL-13 returned to sender. All refunds follow REF-POL-1.0.

**DEL-17** The AI must log every decision with the applicable DEL rule ID.

**DEL-18** The AI must not override any escalation rule in this policy.