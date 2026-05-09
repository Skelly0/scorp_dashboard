.PHONY: install sync test lint clean dev build

install:
	uv sync
	npm install

sync:
	uv run python scripts/sync_sheet.py

test:
	uv run pytest -v
	npm run test -- run

dev:
	npm run dev

build:
	npm run build

clean:
	rm -rf dist node_modules .pytest_cache htmlcov .coverage
