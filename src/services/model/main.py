import keras
import torch
import torchvision.transforms as T
import xarray as xr
from huggingface_hub import hf_hub_download

from services.scans.get_scans import download_scans
from tornet.tornet.data.constants import ALL_VARIABLES
from tornet.tornet.data.loader import read_file
from tornet.tornet.data.preprocess import add_coordinates, remove_time_dim
from tornet.tornet.metrics.keras import metrics as tfm


class Model:
    def __init__(self):
        self.model = keras.saving.load_model(hf_hub_download(repo_id="tornet-ml/tornado_detector_baseline_v1",
                                        filename="tornado_detector_baseline.keras", compile=False))
        self.transform = T.Compose([
            lambda d: add_coordinates(d,include_az=False,tilt_last=False,backend=torch),
            lambda d: remove_time_dim(d)])

        metrics = [ keras.metrics.AUC(from_logits=(from_logits := True),name='AUC',num_thresholds=2000),
                    keras.metrics.AUC(from_logits=from_logits,curve='PR',name='AUCPR',num_thresholds=2000),
                    tfm.BinaryAccuracy(from_logits=from_logits,name='BinaryAccuracy'),
                    tfm.Precision(from_logits=from_logits,name='Precision'),
                    tfm.Recall(from_logits=from_logits,name='Recall'),
                    tfm.F1Score(from_logits=from_logits,name='F1')]
        self.model.compile(metrics=metrics)

    def predict(self, x):
        x = self._prepoc(x)
        return self.model.predict(x)

    def _prepoc(self, file_name):
        data = read_file(file_name, variables=ALL_VARIABLES, tilt_last=True, n_frames=1)
        return self.transform(data)
