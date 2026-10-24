**Retail Flow – Refund Policy for AI Order Exception Agent**  
Effective: 2026-01-01 | Policy ID: REF-POL-1.0

**REF-01** This policy applies to all orders placed on retailflow.com.

**REF-02** A refund is eligible if one of the following is true: (a) a return is approved under RET-POL-1.0; (b) an order is cancelled under REF-08; (c) a damaged, incorrect, or missing item claim is approved under RET-09, RET-11, or RET-12; (d) a duplicate payment is confirmed under REF-11.

**REF-03** A full refund is issued when: (a) all items in the order are approved for return; (b) the order is cancelled before shipment; (c) the order is damaged, incorrect, or missing in full; (d) a duplicate payment is confirmed.

**REF-04** A partial refund is issued when only a subset of items in an order is approved for refund. The AI agent must calculate the partial refund using REF-05.

**REF-05** Refund amount = sum(approved item price paid) + sum(approved item tax paid) + approved shipping refund − approved deductions.

**REF-06** Deductions: If a returned item is missing original accessories, manuals, or packaging, deduct 20% of that item’s price paid. No deduction applies to damaged, incorrect, or missing item claims.

**REF-07** Shipping-cost refunds: (a) Standard returns: original shipping is not refunded. (b) Damaged, incorrect, or missing items: original shipping is refunded in full. (c) Cancellation before shipment: original shipping is refunded in full. (d) Cancellation after shipment: original shipping is not refunded unless the carrier returns the package to Retail Flow.

**REF-08** Cancelled orders: A customer may cancel before order status becomes “Shipped.” The AI agent must issue a full refund of item price, tax, and shipping. After “Shipped,” cancellation is processed as a return under RET-POL-1.0.

**REF-09** Damaged or incorrect products: The AI agent must issue a full refund of item price, tax, and original shipping. If the customer chooses a replacement, no refund is issued; the replacement is processed under RET-POL-1.0.

**REF-10** Missing items: The AI agent must issue a full refund of the missing item’s price and tax, plus a proportional share of original shipping. Proportional shipping = original shipping × (missing item price ÷ order item price total).

**REF-11** Duplicate or failed payments: (a) If the same order is charged more than once, the AI agent must refund the duplicate charge in full. (b) If payment status is “failed” and no order shipped, no refund is issued. (c) If payment status is “failed” but the customer’s bank shows a debit, the AI agent must escalate under REF-15.

**REF-12** Payment-method restrictions: Refunds are issued only to the original payment method. Gift cards are refunded as a new gift card. Digital wallets are refunded to the same wallet. The AI agent must not issue cash, check, or store credit.

**REF-13** Duplicate refund prevention: Before issuing any refund, the AI agent must check the refund ledger. If the order or item already has a completed refund, the AI agent must deny the new refund and escalate under REF-15 if the customer disputes.

**REF-14** Refund timing: The AI agent must initiate an approved refund within 1 business day. Posting time depends on the payment provider.

**REF-15** The AI agent must escalate to a human agent if any of the following is true: (a) refund amount is greater than $500; (b) customer has more than 3 refunds in the previous 90 calendar days; (c) order has a fraud flag; (d) shipping address does not match billing address; (e) original payment method is expired; (f) duplicate payment with failed status; (g) customer requests a refund to a different payment method; (h) item is a regulated good not covered by RET-POL-1.0; (i) customer disputes the AI decision; (j) required evidence is missing or unclear.

**REF-16** The AI agent must not override REF-15.

**REF-17** The AI agent must log every refund decision with the applicable REF rule ID. This policy replaces all prior Retail Flow refund policies for AI-handled exceptions.