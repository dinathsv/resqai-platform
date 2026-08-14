test:
	pytest tests/ -v --asyncio-mode=auto

test-cov:
	pytest tests/ --cov=app --cov-report=html

lint:
	ruff check .

format:
	black . tests/
