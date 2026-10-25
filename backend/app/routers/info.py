"""
GET /api/info — System architecture, dataset metrics, schema definitions,
and test scenarios/catalogs for comprehensive exploration.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/info", tags=["info"])

# Curated test scenarios with real order and product IDs from Olist
SCENARIOS = [
    {
        "case_id": "CASE-001",
        "scenario": "damaged_item",
        "title": "Damaged Item Inspection",
        "order_id": "e481f51cbdc54678b7cc49136f2d6af7",
        "product_id": "87285b34884572647811a353c7ac498a",
        "product_category": "utilidades_domesticas (Housewares)",
        "price": 29.99,
        "customer_message": "My product arrived damaged and I want a refund.",
        "expected_route": "returns",
        "applicable_rule": "RET-09 / RET-10",
        "expected_outcome": "Window comparison against delivery date (7-day report window).",
        "notes": "Delivered on-time historical order. Tests damage reporting rules.",
    },
    {
        "case_id": "CASE-002",
        "scenario": "standard_return",
        "title": "Standard 30-Day Return Window Expiry",
        "order_id": "53cdb2fc8bc7dce0b6741e2150273451",
        "product_id": "595fac2a385ac33a80bd5114aec74eb8",
        "product_category": "perfumaria (Perfume)",
        "price": 118.70,
        "customer_message": "I want to return this item. It is not what I needed.",
        "expected_route": "returns",
        "applicable_rule": "RET-02 / RET-03",
        "expected_outcome": "Denial due to standard 30-day return window expiration.",
        "notes": "Historical delivery date > 30 days old.",
    },
    {
        "case_id": "CASE-003",
        "scenario": "incorrect_item",
        "title": "Wrong Item Delivered",
        "order_id": "47770eb9100c2d0c44946d9cf07ec65d",
        "product_id": "aa4383b373c6aca5d8797843e5594415",
        "product_category": "automotivo (Automotive)",
        "price": 159.90,
        "customer_message": "I received the wrong item. This is not what I ordered. I want a replacement.",
        "expected_route": "returns",
        "applicable_rule": "RET-11",
        "expected_outcome": "Checks 14-day incorrect item window; historical date triggers denial or review.",
        "notes": "Valid automotive order with single item.",
    },
    {
        "case_id": "CASE-004",
        "scenario": "late_delivery_minor",
        "title": "Minor Late Delivery Query",
        "order_id": "949d5b44dbf5de918fe9c16f97b45f8a",
        "product_id": "d0b61bfb1de832b15ba9d266ca96e5b0",
        "product_category": "pet_shop (Pet Supplies)",
        "price": 45.00,
        "customer_message": "My order is three days late and I have not received it yet.",
        "expected_route": "delivery",
        "applicable_rule": "DEL-07",
        "expected_outcome": "Checks estimated delivery date vs current date and delivery status.",
        "notes": "Tests delay calculation logic.",
    },
    {
        "case_id": "CASE-005",
        "scenario": "late_delivery_major",
        "title": "Early Delivery Verification",
        "order_id": "ad21c59c0840e6cb83a9ceb5573f8159",
        "product_id": "65266b2da20d04dbe00c5c2d3bb7859e",
        "product_category": "papelaria (Stationery)",
        "price": 19.90,
        "customer_message": "My package still has not arrived. It is way past the estimated delivery date.",
        "expected_route": "delivery",
        "applicable_rule": "DEL-03 / DEL-04",
        "expected_outcome": "Detects package was actually delivered early by carrier.",
        "notes": "EDD 2018-02-26, delivered 2018-02-16.",
    },
    {
        "case_id": "CASE-006",
        "scenario": "delivered_but_missing",
        "title": "Delivered Status but Package Missing",
        "order_id": "76c6e866289321a7c93b82b54852dc33",
        "product_id": "ac1789e492dcd698c5c10b97a671243a",
        "product_category": "moveis_decoracao (Furniture)",
        "price": 19.90,
        "customer_message": "The tracking says my package was delivered but I did not receive anything. I have checked everywhere.",
        "expected_route": "delivery",
        "applicable_rule": "DEL-12",
        "expected_outcome": "Triggers carrier trace or escalation for missing package investigation.",
        "notes": "Order marked delivered in dataset.",
    },
    {
        "case_id": "CASE-007",
        "scenario": "stuck_in_transit",
        "title": "Stuck in Transit Carrier Trace",
        "order_id": "ee64d42b8cf066f35eac1cf57de1aa85",
        "product_id": "c50ca07e9e4db9ea5011f06802c0aea0",
        "product_category": "beleza_saude (Health & Beauty)",
        "price": 14.49,
        "customer_message": "My order has been in shipped status for weeks and is not moving.",
        "expected_route": "delivery",
        "applicable_rule": "DEL-11",
        "expected_outcome": "Identifies order status is 'shipped' but undelivered → initiates carrier inquiry.",
        "notes": "Active shipped status in Olist orders table.",
    },
    {
        "case_id": "CASE-008",
        "scenario": "duplicate_payment",
        "title": "Duplicate Payment Detection",
        "order_id": "0016dfedd97fc2950e388d2971d718c7",
        "product_id": "4089861a1bd4685da70bddd6b4f974f1",
        "product_category": "ferramentas_jardim (Garden Tools)",
        "price": 49.75,
        "customer_message": "I was charged twice for my order. I can see two payments on my bank statement.",
        "expected_route": "payment",
        "applicable_rule": "PAY-06",
        "expected_outcome": "Payment check tool detects 2 payment records → confirms duplicate charge.",
        "notes": "Order has multiple payment records in payments table.",
    },
    {
        "case_id": "CASE-009",
        "scenario": "payment_status_query",
        "title": "Payment Verification Query",
        "order_id": "002f19a65a2ddd70a090297872e6d64e",
        "product_id": "9eae06d51aaa383b2bed5547a19d581c",
        "product_category": "cama_mesa_banho (Bed & Bath)",
        "price": 53.98,
        "customer_message": "What is the status of my payment? I am not sure if it went through.",
        "expected_route": "payment",
        "applicable_rule": "PAY-03",
        "expected_outcome": "Returns exact payment records, installment count, and total paid.",
        "notes": "Normal payment records verified.",
    },
    {
        "case_id": "CASE-010",
        "scenario": "cancelled_order_refund",
        "title": "Cancelled Order Refund Verification",
        "order_id": "1b9ecfe83cdc259250e1a8aca174f0ad",
        "product_id": "ad673c1cd02b966e931f9db4fdc34791",
        "product_category": "informatica_acessorios (Computers)",
        "price": 25.00,
        "customer_message": "I cancelled my order but I have not received my refund yet.",
        "expected_route": "payment",
        "applicable_rule": "PAY-08 / REF-08",
        "expected_outcome": "Detects order_status='canceled' → approves refund for total order amount.",
        "notes": "Canceled order in dataset.",
    },
    {
        "case_id": "CASE-011",
        "scenario": "damaged_item_high_value",
        "title": "High-Value Escalation Threshold",
        "order_id": "000576fe39319847cbb9d288c5617fa6",
        "product_id": "557d850972a7d6f792fd18ae1400d9b6",
        "product_category": "ferramentas_jardim (Garden Tools)",
        "price": 810.00,
        "customer_message": "My headphones arrived completely smashed. The box looked like it was dropped from a great height. I want a full refund immediately.",
        "expected_route": "returns",
        "applicable_rule": "RET-17 / REF-15(a)",
        "expected_outcome": "Order value R$ 810 exceeds R$ 500 threshold → mandates human agent escalation.",
        "notes": "Tests high-value security rule.",
    },
    {
        "case_id": "CASE-012",
        "scenario": "missing_item",
        "title": "Missing Item in Parcel",
        "order_id": "6514b8ad8028c9f2cc2374ded245783f",
        "product_id": "4520766ec412348b8d4caa5e8a18c464",
        "product_category": "automotivo (Automotive)",
        "price": 59.99,
        "customer_message": "There was a missing item in my delivery. The box was sealed but one of the products was not inside.",
        "expected_route": "returns",
        "applicable_rule": "RET-12",
        "expected_outcome": "14-day missing item report window evaluation.",
        "notes": "Delivered historical order.",
    },
    {
        "case_id": "CASE-013",
        "scenario": "ambiguous_return_request",
        "title": "Ambiguous Return Request Routing",
        "order_id": "a4591c265e18cb1dcee52889e2d8acc3",
        "product_id": "060cb19345d90064d1015407193c233d",
        "product_category": "automotivo (Automotive)",
        "price": 147.90,
        "customer_message": "I am not happy with my purchase and would like to return it.",
        "expected_route": "returns",
        "applicable_rule": "RET-02",
        "expected_outcome": "Routes to returns agent based on semantic intent classification.",
        "notes": "Tests fuzzy intent matching.",
    },
    {
        "case_id": "CASE-014",
        "scenario": "ambiguous_payment_escalation",
        "title": "Vague Billing Complaint Routing",
        "order_id": "714fb133a6730ab81fa1d3c1b2007291",
        "product_id": "a0b7d5a992ccda646f2d34e418fff5a0",
        "product_category": "moveis_decoracao (Furniture)",
        "price": 69.90,
        "customer_message": "I need to speak to someone about a billing problem on my account. Something does not look right.",
        "expected_route": "payment",
        "applicable_rule": "PAY-01 / LLM Fallback",
        "expected_outcome": "Routes to payment agent; Groq fallback provides human-readable explanation.",
        "notes": "Tests LLM fallback for vague complaints.",
    },
    {
        "case_id": "CASE-015",
        "scenario": "invalid_order_id",
        "title": "Invalid / Nonexistent Order ID",
        "order_id": "INVALID-ORDER-99999",
        "product_id": "N/A",
        "product_category": "N/A",
        "price": 0.0,
        "customer_message": "I want a refund for my order.",
        "expected_route": "returns",
        "applicable_rule": "System Validation",
        "expected_outcome": "Graceful error detection → marks escalate=True with invalid order data.",
        "notes": "Deliberate invalid order ID.",
    },
]

SAMPLE_PRODUCTS = [
    {
        "product_id": "87285b34884572647811a353c7ac498a",
        "category": "utilidades_domesticas (Housewares)",
        "weight_g": 650,
        "dimensions": "16 x 11 x 20 cm",
        "photos_qty": 3,
        "typical_order": "e481f51cbdc54678b7cc49136f2d6af7",
    },
    {
        "product_id": "595fac2a385ac33a80bd5114aec74eb8",
        "category": "perfumaria (Perfume)",
        "weight_g": 200,
        "dimensions": "16 x 11 x 11 cm",
        "photos_qty": 1,
        "typical_order": "53cdb2fc8bc7dce0b6741e2150273451",
    },
    {
        "product_id": "aa4383b373c6aca5d8797843e5594415",
        "category": "automotivo (Automotive)",
        "weight_g": 890,
        "dimensions": "28 x 17 x 24 cm",
        "photos_qty": 2,
        "typical_order": "47770eb9100c2d0c44946d9cf07ec65d",
    },
    {
        "product_id": "d0b61bfb1de832b15ba9d266ca96e5b0",
        "category": "pet_shop (Pet Supplies)",
        "weight_g": 400,
        "dimensions": "20 x 15 x 15 cm",
        "photos_qty": 2,
        "typical_order": "949d5b44dbf5de918fe9c16f97b45f8a",
    },
    {
        "product_id": "557d850972a7d6f792fd18ae1400d9b6",
        "category": "ferramentas_jardim (Garden Tools)",
        "weight_g": 14500,
        "dimensions": "50 x 30 x 40 cm",
        "photos_qty": 4,
        "typical_order": "000576fe39319847cbb9d288c5617fa6",
    },
    {
        "product_id": "ad673c1cd02b966e931f9db4fdc34791",
        "category": "informatica_acessorios (Computers)",
        "weight_g": 350,
        "dimensions": "22 x 13 x 18 cm",
        "photos_qty": 1,
        "typical_order": "1b9ecfe83cdc259250e1a8aca174f0ad",
    },
]

DATASET_TABLES = [
    {
        "table_name": "olist_orders_dataset.csv",
        "record_count": 99441,
        "description": "Core transaction table containing order life-cycle timestamps and status.",
        "key_columns": [
            {"name": "order_id", "type": "string (UUID hex)", "description": "Primary key for order."},
            {"name": "customer_id", "type": "string", "description": "Foreign key to customer."},
            {"name": "order_status", "type": "enum", "description": "delivered, shipped, canceled, invoiced, processing."},
            {"name": "order_purchase_timestamp", "type": "datetime", "description": "Time order was placed."},
            {"name": "order_delivered_customer_date", "type": "datetime", "description": "Actual delivery timestamp."},
            {"name": "order_estimated_delivery_date", "type": "datetime", "description": "Estimated delivery deadline."}
        ]
    },
    {
        "table_name": "olist_order_items_dataset.csv",
        "record_count": 112650,
        "description": "Line items per order, including product references, prices, and freight values.",
        "key_columns": [
            {"name": "order_id", "type": "string", "description": "Foreign key to orders."},
            {"name": "order_item_id", "type": "int", "description": "Item sequential index (1, 2, ...)."},
            {"name": "product_id", "type": "string (UUID hex)", "description": "Foreign key to products."},
            {"name": "seller_id", "type": "string", "description": "Merchant ID."},
            {"name": "price", "type": "float", "description": "Item price in BRL (R$)."},
            {"name": "freight_value", "type": "float", "description": "Shipping freight cost in BRL."}
        ]
    },
    {
        "table_name": "olist_products_dataset.csv",
        "record_count": 32951,
        "description": "Product catalog with categories, dimensions, and weights.",
        "key_columns": [
            {"name": "product_id", "type": "string (UUID hex)", "description": "Primary key for product."},
            {"name": "product_category_name", "type": "string", "description": "Category (Portuguese e.g. utilidades_domesticas)."},
            {"name": "product_weight_g", "type": "int", "description": "Weight in grams."},
            {"name": "product_length_cm", "type": "int", "description": "Length in cm."},
            {"name": "product_height_cm", "type": "int", "description": "Height in cm."},
            {"name": "product_width_cm", "type": "int", "description": "Width in cm."}
        ]
    },
    {
        "table_name": "olist_order_payments_dataset.csv",
        "record_count": 103886,
        "description": "Payment records per order, supporting split payments across methods.",
        "key_columns": [
            {"name": "order_id", "type": "string", "description": "Foreign key to orders."},
            {"name": "payment_sequential", "type": "int", "description": "Payment index (1, 2 for split payments)."},
            {"name": "payment_type", "type": "enum", "description": "credit_card, boleto, voucher, debit_card."},
            {"name": "payment_installments", "type": "int", "description": "Number of installments."},
            {"name": "payment_value", "type": "float", "description": "Amount charged in BRL."}
        ]
    },
    {
        "table_name": "olist_customers_dataset.csv",
        "record_count": 99441,
        "description": "Customer demographic and geographic data.",
        "key_columns": [
            {"name": "customer_id", "type": "string", "description": "Order-specific customer key."},
            {"name": "customer_unique_id", "type": "string", "description": "Global customer identifier."},
            {"name": "customer_city", "type": "string", "description": "City of residence."},
            {"name": "customer_state", "type": "string (2 chars)", "description": "Brazilian state code (e.g. SP, RJ, MG)."}
        ]
    }
]


@router.get("", summary="Get system architecture, dataset metrics, and test scenarios")
def get_system_info(request: Request) -> dict[str, Any]:
    return {
        "system": {
            "title": "REROUTE Exception Platform",
            "version": "1.0.0",
            "engine": "LangGraph State Machine + FAISS RAG + Cactus Needle + Groq Fallback",
            "status": "operational",
        },
        "dataset": {
            "name": "Brazilian E-Commerce Public Dataset by Olist",
            "source": "Kaggle (olistbr/brazilian-ecommerce)",
            "total_orders": 99441,
            "total_order_items": 112650,
            "total_products": 32951,
            "total_payments": 103886,
            "total_customers": 99441,
            "date_range": "2016-09 to 2018-10",
            "tables": DATASET_TABLES,
        },
        "sample_products": SAMPLE_PRODUCTS,
        "scenarios": SCENARIOS,
    }
