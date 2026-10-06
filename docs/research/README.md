# Research & Dataset Lineage

This directory stores research notes, literature citations, dataset lineage manifests, and benchmark evaluation protocols.

## Documents

- [ML & Data Pipeline Contract (Phase 2)](data-contract.md) — Canonical specification for dataset inventory, lineage manifests, directory contracts, split protocols, preprocessing parity, and EXP-001 experiment boundaries.

## Dataset Lineage Policy
In compliance with project rule `.agents/rules/ml.md`:
* Raw video files and image frames MUST NEVER be committed to Git.
* Datasets (e.g., 140k Real/Fake, CIFAKE, FaceForensics++) must be documented in lineage manifests under `manifests/` with:
  1. Source download URL and access authorization details.
  2. Exact version, subset, and compression level (where applicable).
  3. Preprocessing, face-cropping, and split protocols (video-level partition for video).
