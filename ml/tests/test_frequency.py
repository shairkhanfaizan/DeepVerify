import pytest
import torch
import pytest
from deepverify_ml.preprocessing.frequency import log_magnitude_fft

def test_output_shape():
    x = torch.rand(3, 224, 224)
    out = log_magnitude_fft(x)
    assert out.shape == (3, 224, 224)

def test_output_type():
    x = torch.rand(3, 224, 224)
    out = log_magnitude_fft(x)
    assert isinstance(out, torch.Tensor)
    assert out.is_floating_point()
    assert not out.is_complex()

def test_finite_values():
    x = torch.rand(3, 224, 224)
    out = log_magnitude_fft(x)
    assert torch.all(torch.isfinite(out))

def test_zero_input():
    x = torch.zeros(3, 224, 224)
    out = log_magnitude_fft(x)
    assert torch.all(torch.isfinite(out))
    # It should map to 0 since min==max handling prevents NaNs
    assert torch.all(out == 0.0)

def test_determinism():
    x = torch.rand(3, 224, 224)
    out1 = log_magnitude_fft(x)
    out2 = log_magnitude_fft(x)
    assert torch.equal(out1, out2)

def test_channel_independence():
    x = torch.rand(3, 224, 224)
    x2 = x.clone()
    # Modify only channel 0
    x2[0] = torch.rand(224, 224)
    
    out1 = log_magnitude_fft(x)
    out2 = log_magnitude_fft(x2)
    
    # Channels 1 and 2 should remain absolutely identical
    assert torch.allclose(out1[1:], out2[1:], atol=1e-6)
    # Channel 0 should differ
    assert not torch.allclose(out1[0], out2[0], atol=1e-6)

def test_device_preservation():
    if not torch.cuda.is_available():
        pytest.skip("CUDA not available")
    
    x = torch.rand(3, 224, 224).cuda()
    out = log_magnitude_fft(x)
    assert out.is_cuda
    assert out.device == x.device

def test_spatial_size_preservation():
    # Test non-224 dimensions
    x = torch.rand(3, 128, 128)
    out = log_magnitude_fft(x)
    assert out.shape == (3, 128, 128)

def test_numerical_stability():
    # Constant values
    x_const = torch.ones(3, 224, 224) * 5.0
    out_const = log_magnitude_fft(x_const)
    assert torch.all(torch.isfinite(out_const))
    
    # Wide range of values
    x_wide = torch.randn(3, 224, 224) * 1000.0
    out_wide = log_magnitude_fft(x_wide)
    assert torch.all(torch.isfinite(out_wide))
    assert torch.all((out_wide >= 0.0) & (out_wide <= 1.0))

def test_synthetic_sanity_constant_image():
    # A constant image has only DC (zero frequency) energy.
    # fftshift should place it exactly at the center.
    H, W = 64, 64
    x = torch.ones(3, H, W)
    out = log_magnitude_fft(x)
    
    center_h, center_w = H // 2, W // 2
    
    for c in range(3):
        # Center should be the max value (which normalizes to 1.0)
        assert out[c, center_h, center_w] == pytest.approx(1.0)
        
        # Surrounding values should be 0.0 (normalized min)
        # Check a few off-center points
        assert out[c, 0, 0] == pytest.approx(0.0)
        assert out[c, 10, 10] == pytest.approx(0.0)

def test_synthetic_sanity_periodic_pattern():
    # Create a simple striped pattern
    H, W = 64, 64
    x = torch.zeros(3, H, W)
    # Vertical stripes in channel 0
    x[0, :, 1::2] = 1.0
    
    out = log_magnitude_fft(x)
    
    center_h, center_w = H // 2, W // 2
    
    # Because of the high frequency stripes (Nyquist), we should see energy 
    # far from the center in the horizontal direction.
    
    # DC component is still strong because average is 0.5
    assert out[0, center_h, center_w] > 0.5
    
    # Nyquist frequency for vertical stripes is at the far left of the shifted W axis
    # The max value will be symmetrically split or at the edges
    assert out[0, center_h, 0] > 0.5 or out[0, center_h, -1] > 0.5
    
    # Confirm it's not uniformly 1.0 everywhere
    assert out[0, center_h, center_w // 2] < 0.1
