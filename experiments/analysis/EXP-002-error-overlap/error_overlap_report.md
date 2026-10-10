# EXP-001 vs EXP-002 Error Overlap Analysis

## Overview
- **Samples Evaluated**: 21000
- **Alignment**: Perfect alignment proven by identical targets arrays.

## Oracle Analysis (Upper Bound)
- **Oracle Accuracy**: 0.9998 (20995/21000)
- **Oracle Errors**: 5
- **Rescued by EXP-002**: 17 (EXP-001 wrong, EXP-002 right)
- **Rescued by EXP-001**: 3832 (EXP-002 wrong, EXP-001 right)
- **Both Wrong**: 5

*Note: This oracle is an upper bound on ensemble performance, not a guaranteed result of averaging.*

## Error Overlap
- **EXP-001 Errors**: 22
- **EXP-002 Errors**: 3837
- **Shared Errors**: 5
- **Jaccard Similarity**: 0.0013

## Probability Correlation
- **Pearson**: 0.6989
- **Spearman**: 0.6485
