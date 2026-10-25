"""
Olist CSV loader.

Loads the five required CSV files into Pandas DataFrames once, then caches
them in module-level variables so subsequent calls pay no I/O cost.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from src.config import OLIST_DATA_DIR

log = logging.getLogger(__name__)

# ── Module-level cache ────────────────────────────────────────────────────────
_orders: Optional[pd.DataFrame] = None
_order_items: Optional[pd.DataFrame] = None
_products: Optional[pd.DataFrame] = None
_payments: Optional[pd.DataFrame] = None
_customers: Optional[pd.DataFrame] = None

# ── Timestamp columns per file ────────────────────────────────────────────────
_TIMESTAMP_COLS = {
    "orders": [
        "order_purchase_timestamp",
        "order_approved_at",
        "order_delivered_carrier_date",
        "order_delivered_customer_date",
        "order_estimated_delivery_date",
    ],
    "order_items": ["shipping_limit_date"],
}


def _load_csv(filename: str, timestamp_cols: list[str] | None = None) -> pd.DataFrame:
    path = Path(OLIST_DATA_DIR) / filename
    if not path.exists():
        raise FileNotFoundError(f"Olist file not found: {path}")
    df = pd.read_csv(path, low_memory=False)
    if timestamp_cols:
        for col in timestamp_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")
    log.debug("Loaded %s  rows=%d", filename, len(df))
    return df


def load_all(force: bool = False) -> None:
    """Load (or reload) all five Olist datasets into the module cache."""
    global _orders, _order_items, _products, _payments, _customers
    if _orders is not None and not force:
        return  # already loaded

    log.info("Loading Olist datasets from %s …", OLIST_DATA_DIR)
    _orders = _load_csv(
        "olist_orders_dataset.csv",
        timestamp_cols=_TIMESTAMP_COLS["orders"],
    )
    _order_items = _load_csv(
        "olist_order_items_dataset.csv",
        timestamp_cols=_TIMESTAMP_COLS["order_items"],
    )
    _products = _load_csv("olist_products_dataset.csv")
    _payments = _load_csv("olist_order_payments_dataset.csv")
    _customers = _load_csv("olist_customers_dataset.csv")
    log.info("Olist datasets loaded successfully.")


# ── Public accessors ──────────────────────────────────────────────────────────

def get_orders() -> pd.DataFrame:
    load_all()
    assert _orders is not None
    return _orders


def get_order_items() -> pd.DataFrame:
    load_all()
    assert _order_items is not None
    return _order_items


def get_products() -> pd.DataFrame:
    load_all()
    assert _products is not None
    return _products


def get_payments() -> pd.DataFrame:
    load_all()
    assert _payments is not None
    return _payments


def get_customers() -> pd.DataFrame:
    load_all()
    assert _customers is not None
    return _customers
