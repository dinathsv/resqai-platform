FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --default-timeout=1000 --retries 10 --upgrade pip && \
    pip install --default-timeout=1000 --retries 10 -r requirements.txt

COPY . .

EXPOSE 5005

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "5005"]
