"""Tests for the Pops Detailed page extractor."""
from __future__ import annotations

from extractors.pops import extract


def test_extract_returns_class_records(wb):
    result = extract(wb)
    assert len(result["classes"]) == 11


def test_extract_income_block_complete(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    inc = bureaucrats["income"]
    assert inc["gross_per_cap"] == 12.0
    assert inc["income_tax_per_cap"] == 1.2
    assert inc["wealth_tax_per_cap"] == 0.24
    assert inc["effective_tax_rate"] == 0.12
    assert inc["disposable_per_cap"] == 12.0 * 0.88
    # Total income before tax = pop * gross_per_cap
    assert inc["total_gross"] == bureaucrats["pop"] * 12.0


def test_extract_status_block_complete(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    s = bureaucrats["status"]
    assert s["radicalisation"] == 0.20
    assert s["abject_poverty"] == 0.10
    assert s["organisation"] == 0.30
    assert s["literacy"] == 0.65


def test_extract_additional_income_breakdown(wb):
    result = extract(wb)
    a = result["classes"][0]["additional_income"]
    assert a["welfare"] == 0.5
    assert a["subsidies"] == 0.2
    assert a["total"] == 0.7


def test_extract_satisfaction_present(wb):
    result = extract(wb)
    assert result["classes"][0]["satisfaction"] == 0.40


def test_extract_living_standards_block(wb):
    result = extract(wb)
    b = result["classes"][0]
    assert b["standard_of_living"] == 0.42
    assert b["expected_sol"] == 0.55
    assert b["social_privileges"] == 0.30
