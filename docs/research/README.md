# Research & Dataset Lineage

This directory stores research notes, literature citations, dataset lineage manifests, and benchmark evaluation protocols.

## Dataset Lineage Policy
In compliance with project rule `.agents/rules/ml.md`:
* Raw video files and image frames MUST NEVER be committed to Git.
* Datasets (e.g., FaceForensics++, DFDC) must be documented here with:
  1. Source download URL and access authorization details.
  2. Exact version, subset, and compression level (e.g., c23, c40, raw).
  3. Preprocessing, face-cropping, and split protocols (video-level partition).
