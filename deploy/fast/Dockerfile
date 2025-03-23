FROM python:3.11-slim

ENV PYTHONPATH="/app/src/"

WORKDIR /app

# TODO: use version locked file
COPY deploy/fast/requirements.in .
RUN pip install --no-cache-dir -r requirements.in

COPY data/nexrad_stations.csv data/nexrad_stations.csv
COPY src/services/ src/services/
COPY src/tornet src/tornet

EXPOSE 8000

CMD ["python", "-m", "fastapi", "dev", "src/services/server/main.py"]
