FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker.py processor.py seed.py scheduler.py ai_router.py ./
CMD ["python", "worker.py"]
