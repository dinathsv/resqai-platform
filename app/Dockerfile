FROM python:3.11-slim

WORKDIR /workspace

COPY app/requirements.txt ./app/
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r app/requirements.txt

COPY app/ ./app/
COPY database/ ./database/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
