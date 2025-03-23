FROM python:3.11-slim

ENV PYTHONPATH="/app/src/"

WORKDIR /app

COPY deploy/fast/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data/nexrad_stations.csv data/nexrad_stations.csv
COPY src/services/ src/services/
COPY src/tornet src/tornet

EXPOSE 8000

CMD ["python", "-m", "fastapi", "dev", "src/services/server/main.py"]
