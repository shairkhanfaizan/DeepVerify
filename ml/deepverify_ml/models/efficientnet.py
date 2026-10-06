"""
EfficientNet-B0 Model Wrapper for DeepVerify EXP-001.
"""

import torch
import torch.nn as nn
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights

class DeepVerifyEfficientNet(nn.Module):
    def __init__(self, num_classes: int = 2, pretrained: bool = True, dropout: float = 0.2, weights_enum: str = "IMAGENET1K_V1"):
        """
        Initializes the EfficientNet-B0 model based on the EXP-001 config.
        """
        super().__init__()
        
        if pretrained:
            # We look up the weights enum dynamically to respect config
            weights = getattr(EfficientNet_B0_Weights, weights_enum, EfficientNet_B0_Weights.IMAGENET1K_V1)
            self.model = efficientnet_b0(weights=weights)
        else:
            self.model = efficientnet_b0(weights=None)
            
        # The original classifier is a Sequential:
        # (0): Dropout(p=0.2, inplace=True)
        # (1): Linear(in_features=1280, out_features=1000, bias=True)
        
        in_features = self.model.classifier[1].in_features
        
        # Replace classifier with our binary classification head
        self.model.classifier = nn.Sequential(
            nn.Dropout(p=dropout, inplace=True),
            nn.Linear(in_features, num_classes)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        Expects: [B, 3, 224, 224]
        Returns: [B, num_classes] floating-point logits.
        No softmax is applied inside the model.
        """
        return self.model(x)

def build_model_from_config(config: dict) -> nn.Module:
    """
    Constructs the model strictly from the provided EXP-001 configuration dictionary.
    """
    model_cfg = config["model"]
    
    if model_cfg["architecture"] != "efficientnet-b0":
        raise ValueError(f"Unsupported architecture: {model_cfg['architecture']}")
        
    return DeepVerifyEfficientNet(
        num_classes=model_cfg["num_classes"],
        pretrained=model_cfg["pretrained"],
        dropout=model_cfg["dropout"],
        weights_enum=model_cfg.get("pretrained_weights", "IMAGENET1K_V1")
    )
