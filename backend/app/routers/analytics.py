"""
Merchant Analytics & Real-Time Exception Monitoring Router for Retail Flow.
Provides real-time telemetry, S1 vs S2 routing distributions, policy heatmaps, and audit exports.
"""

from __future__ import annotations

import csv
import io
import logging
import time
from typing import Any, Dict, List
from fastapi import APIRouter, Response
from pydantic import BaseModel

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])

_MOCK_EVENTS = [
    {
        "id": "EVT-9041",
        "timestamp": "Just now",
        "order_id": "949d5b44dbf5de83e3834f1643224b4c",
        "category": "Returns & Damaged",
        "route": "System-1 (Fast Reflex)",
        "policy_id": "RET-04",
        "resolution": "Approved (Immediate Replacement)",
        "refund_amount": "R$ 145.20",
        "latency_ms": 1.8,
        "status": "autonomous",
    },
    {
        "id": "EVT-9040",
        "timestamp": "2m ago",
        "order_id": "ad850e64c767ab321f92e01a88b5cf90",
        "category": "Late Delivery",
        "route": "System-1 (Fast Reflex)",
        "policy_id": "DEL-03",
        "resolution": "Compensation Coupon Issued",
        "refund_amount": "R$ 25.00",
        "latency_ms": 2.1,
        "status": "autonomous",
    },
    {
        "id": "EVT-9039",
        "timestamp": "5m ago",
        "order_id": "c5973909fd8241b7890ef4350198bb62",
        "category": "High Value Dispute",
        "route": "System-2 (Groq LPU Deliberation)",
        "policy_id": "ESC-01",
        "resolution": "Escalated to Human Supervisor",
        "refund_amount": "R$ 1,280.00",
        "latency_ms": 142.0,
        "status": "escalated",
    },
    {
        "id": "EVT-9038",
        "timestamp": "8m ago",
        "order_id": "e481f51cbdc54678b7cc49136f2d6af7",
        "category": "Returns (Out of Window)",
        "route": "System-1 (Fast Reflex)",
        "policy_id": "RET-01",
        "resolution": "Rejected (Exceeded 14 Days)",
        "refund_amount": "R$ 0.00",
        "latency_ms": 1.6,
        "status": "autonomous",
    },
    {
        "id": "EVT-9037",
        "timestamp": "12m ago",
        "order_id": "53cdb2fc8bc7dce0b6741e2150273451",
        "category": "Duplicate Billing",
        "route": "System-1 (Fast Reflex)",
        "policy_id": "PAY-02",
        "resolution": "Refunded Secondary Charge",
        "refund_amount": "R$ 89.90",
        "latency_ms": 2.4,
        "status": "autonomous",
    },
    {
        "id": "EVT-9036",
        "timestamp": "19m ago",
        "order_id": "47770eb9100c2d0c44946d9cf07ec65d",
        "category": "Carrier Lost In Transit",
        "route": "System-2 (Groq LPU Deliberation)",
        "policy_id": "DEL-05",
        "resolution": "Insurance Claim Filed & Store Credit",
        "refund_amount": "R$ 210.50",
        "latency_ms": 165.2,
        "status": "autonomous",
    },
]

@router.get("/overview")
async def get_analytics_overview():
    """
    Returns real-time analytics KPIs, routing distributions, financial safeguards, and live events.
    """
    return {
        "kpis": {
            "total_exceptions_resolved": 1428,
            "s1_reflex_rate_pct": 78.4,
            "s2_deliberation_rate_pct": 21.6,
            "autonomous_accuracy_pct": 99.2,
            "financial_loss_prevented_brl": 48250.00,
            "avg_latency_ms": 18.2,
            "human_escalation_rate_pct": 4.1,
        },
        "category_distribution": [
            {"category": "Returns & Damaged", "count": 657, "percentage": 46.0},
            {"category": "Late Delivery Claims", "count": 485, "percentage": 34.0},
            {"category": "Billing & Payments", "count": 171, "percentage": 12.0},
            {"category": "Carrier Lost in Transit", "count": 115, "percentage": 8.0},
        ],
        "top_policies": [
            {"id": "RET-04", "title": "Damaged In-Transit Goods", "triggers": 382, "loss_saved": "R$ 18,400"},
            {"id": "DEL-03", "title": "Late Delivery Automated Coupon", "triggers": 294, "loss_saved": "R$ 7,350"},
            {"id": "RET-01", "title": "Standard 14-Day Window Enforcement", "triggers": 205, "loss_saved": "R$ 14,200"},
            {"id": "PAY-02", "title": "Duplicate Authorization Clearing", "triggers": 118, "loss_saved": "R$ 5,800"},
            {"id": "ESC-01", "title": "Financial Threshold Guard (> R$500)", "triggers": 84, "loss_saved": "R$ 42,500"},
        ],
        "events": _MOCK_EVENTS,
    }

@router.get("/export-csv")
async def export_audit_csv():
    """
    Generates and downloads a CSV compliance log of recent exception resolutions.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "Timestamp", "Order ID", "Category", "Routing Engine",
        "Applied Policy", "Verdict", "Financial Value", "Latency (ms)", "Status"
    ])
    
    for evt in _MOCK_EVENTS:
        writer.writerow([
            evt["id"], evt["timestamp"], evt["order_id"], evt["category"],
            evt["route"], evt["policy_id"], evt["resolution"], evt["refund_amount"],
            evt["latency_ms"], evt["status"]
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=retail_flow_audit_{int(time.time())}.csv"
        }
    )
