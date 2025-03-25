import keras
import torch
import torchvision.transforms as T
from huggingface_hub import hf_hub_download

from tornet.tornet.data.loader import read_file
from tornet.tornet.data.preprocess import add_coordinates, remove_time_dim
from tornet.tornet.metrics.keras import metrics as tfm
from tornet.tornet.models.keras.layers import *  # noqa


class Model:
    def __init__(self):
        self.model = keras.saving.load_model(
            hf_hub_download(
                repo_id="tornet-ml/tornado_detector_baseline_v1",
                filename="tornado_detector_baseline.keras",
                local_dir="data/checkpoints",
                local_dir_use_symlinks=False,
            ),
            compile=False,
        )
        self.transform = T.Compose(
            [
                lambda d: add_coordinates(
                    d, include_az=False, tilt_last=False, backend=torch
                ),
                lambda d: remove_time_dim(d),
            ]
        )

        metrics = [
            keras.metrics.AUC(
                from_logits=(from_logits := True), name="AUC", num_thresholds=2000
            ),
            keras.metrics.AUC(
                from_logits=from_logits, curve="PR", name="AUCPR", num_thresholds=2000
            ),
            tfm.BinaryAccuracy(from_logits=from_logits, name="BinaryAccuracy"),
            tfm.Precision(from_logits=from_logits, name="Precision"),
            tfm.Recall(from_logits=from_logits, name="Recall"),
            tfm.F1Score(from_logits=from_logits, name="F1"),
        ]
        self.model.compile(metrics=metrics)

    def predict(self, file_path):
        x = self._prepoc(file_path)
        return self.model.predict(x)

    def _prepoc(self, file_path):
        data = read_file(
            file_path,
            variables=[
                "reflectivity",
                "velocity",
                "differential_phase",
                "cross_correlation_ratio",
                "differential_reflectivity",
                "spectrum_width",
            ],
            tilt_last=True,
            n_frames=1,
        )
        return self.transform(data)


if __name__ == "__main__":
    Model()
