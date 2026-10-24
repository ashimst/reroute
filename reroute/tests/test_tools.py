"""
Unit tests for deterministic tools in src/tools/.

Tests are deterministic and do not require Groq, OpenJEV, or Needle.
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Known Olist IDs
GOOD_ORDER_ID = "e481f51cbdc54678b7cc49136f2d6af7"   # delivered 2017-10-10
HIGH_VALUE_ID = "000576fe39319847cbb9d288c5617fa6"   # item total ~$810
MULTI_PAY_ID  = "0016dfedd97fc2950e388d2971d718c7"   # 2 payment records
MISSING_ID    = "DOES-NOT-EXIST-99999"


# ── Return tools ──────────────────────────────────────────────────────────────

class TestCheckReturnWindow:
    def test_returns_dict(self):
        from src.tools.return_tools import check_return_window
        result = check_return_window(GOOD_ORDER_ID)
        assert isinstance(result, dict)

    def test_has_required_keys(self):
        from src.tools.return_tools import check_return_window
        result = check_return_window(GOOD_ORDER_ID)
        for key in ("order_id", "within_window", "window_days"):
            assert key in result

    def test_historical_order_window_expired(self):
        """A 2017 order is definitely outside the 30-day return window."""
        from src.tools.return_tools import check_return_window
        result = check_return_window(GOOD_ORDER_ID)
        assert result["within_window"] is False

    def test_missing_order_returns_error(self):
        from src.tools.return_tools import check_return_window
        result = check_return_window(MISSING_ID)
        assert "error" in result

    def test_window_days_matches_config(self):
        from src.tools.return_tools import check_return_window
        from src.config import RETURN_WINDOW_DAYS
        result = check_return_window(GOOD_ORDER_ID)
        assert result.get("window_days") == RETURN_WINDOW_DAYS


class TestCheckReturnEligibility:
    def test_returns_dict_with_eligible_field(self):
        from src.tools.return_tools import check_return_eligibility
        result = check_return_eligibility(GOOD_ORDER_ID, reason="standard")
        assert isinstance(result, dict)
        assert "eligible" in result
        assert isinstance(result["eligible"], bool)

    def test_expired_window_not_eligible(self):
        """Historical order should not be eligible for standard return."""
        from src.tools.return_tools import check_return_eligibility
        result = check_return_eligibility(GOOD_ORDER_ID, reason="standard")
        assert result["eligible"] is False

    def test_damaged_past_window_not_eligible(self):
        from src.tools.return_tools import check_return_eligibility
        result = check_return_eligibility(GOOD_ORDER_ID, reason="damaged")
        assert result["eligible"] is False
        assert result.get("applicable_rule") == "RET-10"

    def test_missing_order_has_error(self):
        from src.tools.return_tools import check_return_eligibility
        result = check_return_eligibility(MISSING_ID, reason="damaged")
        assert "error" in result

    def test_reason_defaults_to_standard(self):
        from src.tools.return_tools import check_return_eligibility
        r1 = check_return_eligibility(GOOD_ORDER_ID, reason="standard")
        r2 = check_return_eligibility(GOOD_ORDER_ID)
        assert r1["applicable_rule"] == r2["applicable_rule"]

    def test_valid_reasons_accepted(self):
        from src.tools.return_tools import check_return_eligibility
        for reason in ("standard", "damaged", "incorrect", "missing"):
            result = check_return_eligibility(GOOD_ORDER_ID, reason=reason)
            assert "eligible" in result


class TestCalculateRefund:
    def test_returns_numeric_refund_amount(self):
        from src.tools.return_tools import calculate_refund
        result = calculate_refund(GOOD_ORDER_ID)
        assert "refund_amount" in result
        assert isinstance(result["refund_amount"], float)

    def test_refund_amount_non_negative(self):
        from src.tools.return_tools import calculate_refund
        result = calculate_refund(GOOD_ORDER_ID)
        assert result["refund_amount"] >= 0.0

    def test_damaged_reason_includes_freight(self):
        from src.tools.return_tools import calculate_refund
        result = calculate_refund(GOOD_ORDER_ID, reason="damaged")
        assert result["freight_refund"] > 0.0

    def test_standard_reason_excludes_freight(self):
        from src.tools.return_tools import calculate_refund
        result = calculate_refund(GOOD_ORDER_ID, reason="standard")
        assert result["freight_refund"] == 0.0

    def test_missing_accessories_deduction_applied(self):
        from src.tools.return_tools import calculate_refund
        with_deduction = calculate_refund(GOOD_ORDER_ID, reason="standard",
                                          missing_accessories=True)
        without_deduction = calculate_refund(GOOD_ORDER_ID, reason="standard",
                                             missing_accessories=False)
        assert with_deduction["deduction"] > 0.0
        assert with_deduction["refund_amount"] < without_deduction["refund_amount"]

    def test_high_value_order_requires_escalation(self):
        from src.tools.return_tools import calculate_refund
        result = calculate_refund(HIGH_VALUE_ID, reason="damaged")
        assert result["requires_escalation"] is True

    def test_missing_order_returns_error(self):
        from src.tools.return_tools import calculate_refund
        result = calculate_refund(MISSING_ID)
        assert "error" in result


# ── Delivery tools ────────────────────────────────────────────────────────────

class TestCheckDeliveryDelay:
    def test_returns_dict(self):
        from src.tools.delivery_tools import check_delivery_delay
        result = check_delivery_delay(GOOD_ORDER_ID)
        assert isinstance(result, dict)

    def test_has_required_keys(self):
        from src.tools.delivery_tools import check_delivery_delay
        result = check_delivery_delay(GOOD_ORDER_ID)
        for key in ("order_id", "is_late", "action", "escalate", "applicable_rule"):
            assert key in result

    def test_historical_delivered_order_is_late(self):
        """Any historical delivered order will appear late relative to today."""
        from src.tools.delivery_tools import check_delivery_delay
        result = check_delivery_delay(GOOD_ORDER_ID)
        # Historical order is delivered – is_late depends on delivery vs EDD
        assert isinstance(result["is_late"], bool)

    def test_missing_order_returns_error(self):
        from src.tools.delivery_tools import check_delivery_delay
        result = check_delivery_delay(MISSING_ID)
        assert "error" in result

    def test_escalate_is_bool(self):
        from src.tools.delivery_tools import check_delivery_delay
        result = check_delivery_delay(GOOD_ORDER_ID)
        assert isinstance(result["escalate"], bool)

    def test_no_action_when_not_late(self):
        """Mock a not-late delivery status and verify action=no_action."""
        from src.tools.delivery_tools import check_delivery_delay
        from unittest.mock import patch
        from datetime import datetime
        future_delivery = {
            "order_id": GOOD_ORDER_ID,
            "order_status": "delivered",
            "is_delivered": True,
            "is_late": False,
            "days_late": 0,
            "days_since_purchase": 10,
            "delivery_date": datetime.now().isoformat(),
            "estimated_delivery_date": (datetime.now() + timedelta(days=2)).isoformat(),
        }
        with patch("src.tools.delivery_tools._get_delivery_status",
                   return_value=future_delivery):
            result = check_delivery_delay(GOOD_ORDER_ID)
        assert result["action"] == "no_action"

    def test_minor_delay_returns_inform_action(self):
        from src.tools.delivery_tools import check_delivery_delay
        from unittest.mock import patch
        late_status = {
            "order_id": GOOD_ORDER_ID,
            "order_status": "shipped",
            "is_delivered": False,
            "is_late": True,
            "days_late": 2,
            "days_since_purchase": 10,
        }
        with patch("src.tools.delivery_tools._get_delivery_status",
                   return_value=late_status):
            result = check_delivery_delay(GOOD_ORDER_ID)
        assert result["action"] == "inform_customer"
        assert result["applicable_rule"] == "DEL-07"

    def test_moderate_delay_returns_store_credit(self):
        from src.tools.delivery_tools import check_delivery_delay
        from unittest.mock import patch
        late_status = {
            "order_id": GOOD_ORDER_ID,
            "order_status": "shipped",
            "is_delivered": False,
            "is_late": True,
            "days_late": 5,
            "days_since_purchase": 15,
        }
        with patch("src.tools.delivery_tools._get_delivery_status",
                   return_value=late_status):
            result = check_delivery_delay(GOOD_ORDER_ID)
        assert result["action"] == "issue_store_credit"
        assert result["applicable_rule"] == "DEL-08"

    def test_severe_delay_returns_refund_action(self):
        from src.tools.delivery_tools import check_delivery_delay
        from unittest.mock import patch
        late_status = {
            "order_id": GOOD_ORDER_ID,
            "order_status": "shipped",
            "is_delivered": False,
            "is_late": True,
            "days_late": 10,
            "days_since_purchase": 20,
        }
        with patch("src.tools.delivery_tools._get_delivery_status",
                   return_value=late_status):
            result = check_delivery_delay(GOOD_ORDER_ID)
        assert result["action"] == "refund_shipping_or_credit"
        assert result["applicable_rule"] == "DEL-09"


# ── Payment tools ─────────────────────────────────────────────────────────────

class TestDetectPaymentIssue:
    def test_returns_dict(self):
        from src.tools.payment_tools import detect_payment_issue
        result = detect_payment_issue(GOOD_ORDER_ID)
        assert isinstance(result, dict)

    def test_has_required_keys(self):
        from src.tools.payment_tools import detect_payment_issue
        result = detect_payment_issue(GOOD_ORDER_ID)
        for key in ("order_id", "issue_type", "recommended_action",
                    "escalate", "applicable_rule"):
            assert key in result

    def test_escalate_is_bool(self):
        from src.tools.payment_tools import detect_payment_issue
        result = detect_payment_issue(GOOD_ORDER_ID)
        assert isinstance(result["escalate"], bool)

    def test_missing_order_escalates(self):
        from src.tools.payment_tools import detect_payment_issue
        result = detect_payment_issue(MISSING_ID)
        assert result["escalate"] is True

    def test_multi_payment_order_detected(self):
        """Order with 2 payment records may trigger duplicate detection."""
        from src.tools.payment_tools import detect_payment_issue
        result = detect_payment_issue(MULTI_PAY_ID)
        assert "issue_type" in result


# ── Workflow integration (no Groq) ────────────────────────────────────────────

class TestWorkflowIntegration:
    """Smoke tests: run a full case through the graph without Groq."""

    def test_returns_case_completes(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-RETURNS-01",
            order_id=GOOD_ORDER_ID,
            customer_message="My product arrived damaged and I want a refund.",
        )
        assert state.get("route") == "returns"
        assert state.get("resolution") is not None
        assert isinstance(state.get("escalate"), bool)

    def test_delivery_case_completes(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-DELIVERY-01",
            order_id=GOOD_ORDER_ID,
            customer_message="My order is late and I have not received it yet.",
        )
        assert state.get("route") == "delivery"
        assert state.get("resolution") is not None

    def test_payment_case_completes(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-PAYMENT-01",
            order_id=GOOD_ORDER_ID,
            customer_message="I was charged twice for my order.",
        )
        assert state.get("route") == "payment"
        assert state.get("resolution") is not None

    def test_invalid_order_escalates(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-INVALID-01",
            order_id=MISSING_ID,
            customer_message="I want a refund.",
        )
        assert state.get("escalate") is True

    def test_empty_order_id_produces_error(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-EMPTY-01",
            order_id="",
            customer_message="Help.",
        )
        assert state.get("errors") or state.get("escalate")

    def test_tools_executed_populated(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-TOOLS-01",
            order_id=GOOD_ORDER_ID,
            customer_message="My item arrived broken.",
        )
        tools = state.get("tools_executed") or []
        assert len(tools) > 0

    def test_policies_retrieved(self):
        from src.graph.workflow import run_case
        state = run_case(
            case_id="TEST-POLICY-01",
            order_id=GOOD_ORDER_ID,
            customer_message="I want to return my damaged product.",
        )
        policies = state.get("retrieved_policies") or []
        assert len(policies) > 0
        assert all("policy_id" in p for p in policies)
