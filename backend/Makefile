VENV = ../.venv/bin

.PHONY: dev index

dev:
	$(VENV)/uvicorn app.main:app --reload

index:
	$(VENV)/python -m app.rag.build_index
