"""
DeepVerify EXP-002 Frequency-Domain Preprocessing
=================================================

This module implements the deterministic frequency-domain representation 
designed for EXP-002.

The pipeline explicitly implements the following transformation for an input RGB tensor:
1. per-channel 2D FFT
2. magnitude
3. log(1 + magnitude)
4. fftshift (centers the DC / zero-frequency component)
5. per-image, per-channel min-max normalization

Properties:
- Phase information is explicitly discarded.
- No dataset-level statistics are read or utilized, completely eliminating 
  statistical data leakage between train and test sets.
- The transform preserves the spatial shape (e.g., [3, H, W] -> [3, H, W]). It does 
  not automatically resize inputs.
"""

import torch

def log_magnitude_fft(image_tensor: torch.Tensor) -> torch.Tensor:
    """
    Computes a deterministic log-magnitude 2D FFT representation of a 3-channel image tensor.
    
    Args:
        image_tensor (torch.Tensor): A floating point tensor of shape [3, H, W].
        
    Returns:
        torch.Tensor: A real-valued floating point tensor of shape [3, H, W],
            containing the shifted, normalized log-magnitude spectrum.
    """
    if not isinstance(image_tensor, torch.Tensor):
        raise TypeError("Input must be a torch.Tensor")
    
    if image_tensor.ndim != 3 or image_tensor.shape[0] != 3:
        raise ValueError(f"Input tensor must have shape [3, H, W], got {image_tensor.shape}")
        
    if not image_tensor.is_floating_point():
        image_tensor = image_tensor.float()

    # 1. Compute the 2D FFT over the spatial dimensions (-2, -1)
    # This automatically processes each of the 3 channels independently.
    fft_result = torch.fft.fft2(
        image_tensor, 
        dim=(-2, -1),
        norm="backward",
    )
    
    # 2. Magnitude (discard phase)
    magnitude = torch.abs(fft_result)
    
    # 3. Log transform: log1p ensures numerical stability (handles 0 magnitude gracefully)
    log_mag = torch.log1p(magnitude)
    
    # 4. fftshift: move zero-frequency (DC component) to the center of the HxW plane
    shifted_log_mag = torch.fft.fftshift(log_mag, dim=(-2, -1))
    
    # 5. Normalization (Per-image, per-channel min-max to [0, 1])
    # This normalization is computed independently for each image and RGB channel.
    # It avoids train/validation/test statistical leakage, maps the transformed
    # spectrum into [0,1], and preserves relative spectral distribution, but removes
    # absolute spectral-amplitude scale across images/channels. EXP-002 therefore
    # evaluates discriminative information in the normalized log-magnitude spectral
    # representation rather than absolute spectral energy.
    min_vals = shifted_log_mag.amin(dim=(-2, -1), keepdim=True)
    max_vals = shifted_log_mag.amax(dim=(-2, -1), keepdim=True)
    
    # Avoid division by zero for constant/blank channels
    range_vals = max_vals - min_vals
    range_vals = torch.where(range_vals > 0, range_vals, torch.ones_like(range_vals))
    
    normalized = (shifted_log_mag - min_vals) / range_vals
    
    return normalized
