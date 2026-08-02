# Root-cause penalty model

## Status: Approved v2 methodology baseline

One underlying problem may affect several categories. Its evidence and symptoms remain visible, but Phase 15 prevents duplicate full penalties.

* Primary root-cause effect: 100% of the configured eligible effect.
* Secondary root-cause effect: 25% of the eligible primary effect.
* Associated grouped symptom effect: 25% of its raw eligible effect.
* Per-category cap attributable to one root cause: 15 points.
* Global cap attributable to one root cause across all categories: 20 points.

The engine processes the fixed canonical category order deterministically, preserves raw, applied, and suppressed amounts, and never treats unavailable provider or module measurements as quality deductions. No overall V2 score is calculated in Phase 15.