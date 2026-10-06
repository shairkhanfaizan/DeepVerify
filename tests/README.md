# DeepVerify Test Suite

This directory contains automated test suites enforcing the testing pyramid codified in `.agents/rules/testing.md`.

## Test Organization
* `tests/unit/` — Unit tests for deterministic algorithms, utility helpers, and isolated business logic.
* `tests/integration/` — Integration tests for FastAPI endpoints, media upload validation, and storage mechanics.
* `tests/e2e/` — End-to-end workflow tests validating complete request-to-response cycles.
* `tests/ml/` — Production inference invariant tests (verifying model loading, input/output tensor shapes, value ranges, and preprocessing consistency).

## Invariant Notice
Per `.agents/rules/testing.md`, ML production tests verify model loading and inference shapes. Gradient-flow testing is explicitly NOT a production inference requirement.
