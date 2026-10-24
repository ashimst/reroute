"""
Unit tests for src/data/repository.py

Tests are deterministic and do not require Groq, OpenJEV, or Needle.
They use the real Olist CSV files bundled in data/olist/.
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.repository import (
    get_customer,
    get_delivery_status,
    get_order,
    get_order_items,
    get_payment,
    get_product,
)

# ── Known good IDs from the Olist dataset ────────────────────────────────────
GOOD_ORDER_ID = "e481f51cbdc54678b7cc49136f2d6af7"
MISSING_ORDER_ID = "DOES-NOT-EXIST-00000"


# ── get_order ─────────────────────────────────────────────────────────────────

class TestGetOrder:
    def test_returns_dict_for_valid_id(self):
        result = get_order(GOOD_ORDER_ID)
        assert result is not None
        assert isinstance(result, dict)

    def test_has_expected_keys(self):
        result = get_order(GOOD_ORDER_ID)
        for key in ("order_id", "customer_id", "order_status",
                    "order_purchase_timestamp", "order_estimated_delivery_date"):
            assert key in result, f"Missing key: {key}"

    def test_order_id_matches(self):
        result = get_order(GOOD_ORDER_ID)
        assert result["order_id"] == GOOD_ORDER_ID

    def test_returns_none_for_missing_id(self):
        result = get_order(MISSING_ORDER_ID)
        assert result is None

    def test_timestamps_are_strings_or_none(self):
        result = get_order(GOOD_ORDER_ID)
        ts = result.get("order_purchase_timestamp")
        # Should be an ISO string or None, not a Pandas Timestamp
        assert ts is None or isinstance(ts, str)


# ── get_order_items ───────────────────────────────────────────────────────────

class TestGetOrderItems:
    def test_returns_list_for_valid_id(self):
        result = get_order_items(GOOD_ORDER_ID)
        assert isinstance(result, list)
        assert len(result) >= 1

    def test_each_item_has_expected_keys(self):
        items = get_order_items(GOOD_ORDER_ID)
        for item in items:
            for key in ("order_id", "product_id", "price", "freight_value"):
                assert key in item, f"Missing key: {key}"

    def test_returns_empty_list_for_missing_id(self):
        result = get_order_items(MISSING_ORDER_ID)
        assert result == []

    def test_prices_are_numeric(self):
        items = get_order_items(GOOD_ORDER_ID)
        for item in items:
            price = item.get("price")
            assert price is None or isinstance(price, (int, float))


# ── get_payment ───────────────────────────────────────────────────────────────

class TestGetPayment:
    def test_returns_list_for_valid_id(self):
        result = get_payment(GOOD_ORDER_ID)
        assert isinstance(result, list)
        assert len(result) >= 1

    def test_each_record_has_expected_keys(self):
        records = get_payment(GOOD_ORDER_ID)
        for rec in records:
            for key in ("order_id", "payment_type", "payment_value"):
                assert key in rec, f"Missing key: {key}"

    def test_returns_empty_list_for_missing_id(self):
        result = get_payment(MISSING_ORDER_ID)
        assert result == []

    def test_payment_value_is_positive(self):
        records = get_payment(GOOD_ORDER_ID)
        for rec in records:
            val = rec.get("payment_value", 0)
            if val is not None:
                assert float(val) >= 0


# ── get_delivery_status ───────────────────────────────────────────────────────

class TestGetDeliveryStatus:
    def test_returns_dict_for_valid_id(self):
        result = get_delivery_status(GOOD_ORDER_ID)
        assert result is not None
        assert isinstance(result, dict)

    def test_has_expected_keys(self):
        result = get_delivery_status(GOOD_ORDER_ID)
        for key in ("order_id", "order_status", "is_delivered", "is_late",
                    "days_late", "days_since_purchase"):
            assert key in result, f"Missing key: {key}"

    def test_is_delivered_is_bool(self):
        result = get_delivery_status(GOOD_ORDER_ID)
        assert isinstance(result["is_delivered"], bool)

    def test_days_late_is_non_negative(self):
        result = get_delivery_status(GOOD_ORDER_ID)
        assert result["days_late"] >= 0

    def test_returns_none_for_missing_id(self):
        result = get_delivery_status(MISSING_ORDER_ID)
        assert result is None

    def test_delivered_order_is_marked_delivered(self):
        # This order is known to be delivered
        result = get_delivery_status(GOOD_ORDER_ID)
        assert result["is_delivered"] is True
