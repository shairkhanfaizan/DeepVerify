# DeepVerify

**DeepVerify** is a cyber-forensics platform designed to analyze digital media for synthetic manipulation (AI-generated fakes). It serves as a University B.Tech project focusing on secure evidence handling, model ensembling, and transparent reporting.

> **Important Limitation**: DeepVerify is currently limited to **still-image analysis**. It has been trained on the FFHQ (real) and StyleGAN (fake) datasets (70,000 images each). Generalization to arbitrary, real-world "in-the-wild" images, different generative models (e.g., Stable Diffusion, Midjourney), or video analysis is **unproven and unsupported**.

## Features

- **Secure Photo Vault & Investigations**: Group evidence into cases with strict user-ownership enforcement.
- **Ensemble Inference**: Analyzes images using a 60/40 weighted ensemble of Spatial (EfficientNet-B0) and Frequency (2D FFT Magnitude) models.
- **Explainable AI (XAI)**: Generates Grad-CAM activation heatmaps to highlight manipulated regions.
- **Forensic PDF Reports**: Generates deterministic, tamper-evident PDF dossiers directly from the backend database (using `reportlab`).
- **Data Export**: Export investigation findings as CSV spreadsheets.

## Architecture

DeepVerify employs a modern decoupled architecture:
1. **Frontend**: React Single-Page Application built with Vite and TailwindCSS, enforcing a strict dark-mode cyber-forensics aesthetic.
2. **Backend**: FastAPI (Python 3.11) handling RESTful endpoints, JWT cookie-based session authentication, and orchestration of the ML pipeline.
3. **Database**: PostgreSQL storing relational metadata (`Investigations`, `EvidenceItems`, `AnalysisResults`), managed via SQLAlchemy and Alembic migrations.
4. **Storage**: Local filesystem storage (with safe path-traversal prevention) for handling raw evidence and generated heatmap artifacts.

Please see the detailed [DeepVerify Architecture](docs/DeepVerify_Architecture.md) and [Machine Learning Documentation](ml/README.md) for more information.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.11+
- Docker and Docker Compose (for PostgreSQL)

### 1. Database Setup
Start the PostgreSQL database using Docker Compose:
```bash
docker-compose up -d
```

### 2. Backend Setup
Create a virtual environment and install dependencies. We recommend using `uv`:
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -e .
uv pip install -r requirements.txt # if applicable, or rely on pyproject.toml
```

**Environment Variables**:
Create a `.env` file in the `backend/` directory based on the `.env.example`:
```env
# .env
DATABASE_URL=postgresql+asyncpg://deepverify:deepverify@localhost:5432/deepverify
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
STORAGE_DIR=storage
```

**Run Migrations**:
```bash
alembic upgrade head
```

**Download Models**:
Model weights (`.onnx` or PyTorch `.pt`) must be placed in the `deepverify-models/` directory at the project root. Please refer to `ml/README.md` for weight structures.

**Start the Backend API**:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The application will be available at `http://localhost:5173`.

## Testing & Build

**Backend Tests**:
Run the automated test suite using pytest:
```bash
cd backend
uv run pytest tests/
```

**Frontend Production Build**:
```bash
cd frontend
npm run build
```

## Documentation

- [DeepVerify Architecture](docs/DeepVerify_Architecture.md)
- [ML Pipeline & Limitations](ml/README.md)
- [ADR-006: PostgreSQL Persistence](docs/adrs/ADR-006-v2-domain-model-postgresql.md)
- [ADR-007: Server-Side PDF Reporting](docs/adrs/ADR-007-server-side-forensic-reporting.md)
- [ADR-008: Ensemble Score Interpretation](docs/adrs/ADR-008-ensemble-score-interpretation.md)

## Security Note
This platform was built as a university project. It demonstrates secure JWT handling, parameterized queries, and safe file access via UUIDs. However, it has not undergone an independent professional security audit. Do not deploy to a public-facing production environment without further hardening.
