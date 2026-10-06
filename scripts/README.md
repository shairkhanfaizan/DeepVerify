# Automation & Utility Scripts

This directory contains standalone operational scripts for development, dataset verification, benchmark execution, and environment setup.

## Usage Principles
* Scripts must be parameterized using standard CLI parsing libraries (e.g., `argparse` or `typer`).
* Scripts must never hardcode file paths or credentials.
* Media operations executed via subprocesses must strictly pass argument lists without `shell=True`.
