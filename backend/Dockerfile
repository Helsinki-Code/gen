FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
ENV PORT=8000

# Python entrypoint — no shell script (Windows CRLF cannot break startup).
CMD ["python", "-m", "entrypoint"]
