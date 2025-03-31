FROM python:3.11-slim

ENV PYTHONPATH="/app/src/"

WORKDIR /app

COPY data/nexrad_stations.csv data/nexrad_stations.csv
# COPY data/checkpoints/tornado_detector_baseline.keras data/checkpoints/tornado_detector_baseline.keras

# TODO: use version locked file
COPY deploy/api/requirements.in ./requirements.txt
# RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
RUN pip install -r requirements.txt

COPY src/services/ src/services/
COPY src/tornet src/tornet

EXPOSE 5171

CMD ["uvicorn", "services.api.api:app", "--host", "0.0.0.0", "--port", "5171"]
