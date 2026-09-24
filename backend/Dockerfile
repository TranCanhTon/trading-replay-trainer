# --- builder ---
FROM python:3.10-slim AS builder

WORKDIR /app
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- runtime ---
FROM python:3.10-slim AS runtime

WORKDIR /app
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]