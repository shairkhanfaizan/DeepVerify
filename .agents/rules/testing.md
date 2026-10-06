# DeepVerify Testing Rules

## 1. Testing Pyramid
- **Unit Tests:** Must cover algorithms, utility functions, and small isolated components.
- **Integration Tests:** Must cover API endpoints and database interactions.
- **End-to-End Tests:** Must validate the complete flow from UI (or API client) to model prediction and back.
- **ML Production/Inference Tests:** Must verify:
  - Model loads successfully
  - Checkpoint is compatible with current model/code
  - Expected input shape is accepted
  - Expected output shape/type/range is correct
  - Preprocessing is consistent with training
  - Deterministic inference is verified where applicable
  *(Note: Gradient-flow testing is not a mandatory production inference invariant; it may exist in training/model-development tests if later justified).*

## 2. ML Preprocessing Verification
- Tests MUST verify that the preprocessing pipeline applied during inference is identical to the one applied during training.

## 3. Definition of Done
A feature or task is only considered complete when:
- The code is fully implemented.
- Tests are written and passing.
- The PR (or branch) has been reviewed.
- Relevant documentation is updated.
- An Architecture Decision Record (ADR) is written (if a major decision was made).

## 4. Verification Before Completion
- The agent MUST run verification commands (tests, linting, build checks) and confirm their success before claiming that a task is finished.
- Evidence of success must precede assertions of completeness.
