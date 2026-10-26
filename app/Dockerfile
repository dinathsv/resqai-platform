FROM python:3.11-slim

WORKDIR /workspace

COPY app/requirements.txt ./app/
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --default-timeout=1000 --retries 10 --upgrade pip && \
    pip install --default-timeout=1000 --retries 10 -r app/requirements.txt

COPY app/ ./app/
COPY database/ ./database/

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
