# DeepVerify — Explainability Semantics

## 1. Grad-CAM Overview
Grad-CAM (Gradient-weighted Class Activation Mapping) is integrated into DeepVerify to provide a saliency/explanation visualization. It highlights the spatial regions of the image most strongly associated with the model's final prediction.

**Critical Scientific Framing:**
- Grad-CAM is **NOT** causal proof of manipulation or synthesis.
- It must **not** be described as proving that a particular region is AI-generated. It simply shows where the model "looked" to make its decision.
- The ensemble prediction remains the definitive and authoritative prediction. The heatmap serves only as supporting visual evidence for the user.

## 2. Spatial Model Grad-CAM (EXP-001)
The spatial model (EfficientNet-B0) operates directly on the spatial pixel domain.
- **Target Layer**: `features[-1]` (the final convolutional layer before global average pooling).
- **Target Class**: The Grad-CAM heatmap is explicitly computed with respect to the class predicted by the spatial model.
- **Normalization**: Heatmaps are normalized safely using min-max scaling to the `[0, 1]` range and resized back to the `224x224` input dimensions using bilinear interpolation.

## 3. Frequency Model Explainability (EXP-002)
The frequency model (EXP-002) operates on FFT-derived input (log-magnitude spectrum shifted to center).
- **Scientific Limitation**: A Grad-CAM heatmap generated from the frequency model highlights salient *frequencies*, not spatial pixels.
- **Misleading Transformation**: Mapping frequency-domain saliency back to the original spatial image via Inverse FFT (or naive overlay) is scientifically misleading. Artifacts often manifest globally across frequencies rather than localized to a specific spatial coordinate.
- **V1 Decision**: We deliberately do **not** expose a frequency-based Grad-CAM to the user. The frequency model is retained purely as a mathematical signal in the 60/40 ensemble.

## 4. Ensemble Explanation (EXP-003)
The DeepVerify V1 ensemble mathematically averages the probabilities from the independent spatial and frequency models (60% Spatial / 40% Frequency).
- We do **NOT** calculate a fake "ensemble Grad-CAM", as the two domains are mathematically disjoint.
- **User-Facing Description**: The visual explanation presented to the user must be described strictly as: *"Spatial model saliency supporting the ensemble prediction."*

## 5. Output Contract
The output of the explainability module follows a strict internal JSON schema (rendered by the frontend as an image).
```json
{
  "available": true,
  "method": "grad-cam",
  "model": "spatial-efficientnet-b0",
  "target_class": "REAL",
  "heatmap": "<numpy array, converted to PNG/WebP by backend>"
}
```
This isolates the frontend from raw model tensors while maintaining a consistent metadata contract.
