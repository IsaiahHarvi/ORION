import os

import keras
import matplotlib.pyplot as plt
import pandas as pd
from huggingface_hub import hf_hub_download

from tornet.tornet.data.loader import TornadoDataLoader
from tornet.tornet.display.display import plot_radar
from tornet.tornet.metrics.keras import metrics as tfm
from tornet.tornet.models.keras.layers import *  # noqa


def get_pretrained():
    model = keras.saving.load_model(
        hf_hub_download(
            repo_id="tornet-ml/tornado_detector_baseline_v1",
            filename="tornado_detector_baseline.keras",
            local_dir="data/checkpoints",
            local_dir_use_symlinks=False,
        ),
        compile=False,
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
    model.compile(metrics=metrics)
    return model


def plot(file_list):
    vars_to_plot = ["DBZ", "VEL", "KDP", "RHOHV", "ZDR", "WIDTH"]

    # Grab a single sample using data loader
    dindx = 3  # 22
    n_frames = 4
    data_loader = TornadoDataLoader(
        file_list, variables=vars_to_plot, n_frames=n_frames
    )
    data = data_loader[dindx]

    fig = plt.figure(figsize=(12, 6))

    plot_radar(
        data,
        fig=fig,
        channels=vars_to_plot,
        include_cbar=True,
        time_idx=-1,  # show last frame
        n_rows=2,
        n_cols=3,
    )

    # Add a caption
    fig.text(
        0.5,
        0.05,
        os.path.basename(data_loader.file_list[dindx])
        + " EF="
        + str(data["ef_number"][0]),
        ha="center",
    )


def get_files():
    data_root = os.environ.get("TORNET_ROOT", "data/TorNet/")
    catalog = pd.read_csv(
        os.path.join(data_root, "catalog.csv"), parse_dates=["start_time", "end_time"]
    )

    # Setset catalog to get training data from certain years with strong tornaodes
    years = [2019, 2020]
    min_ef = 2

    subset = catalog[
        (catalog.start_time.dt.year.isin(years))
        & (catalog["type"] == "train")
        & (catalog["ef_number"] >= min_ef)
    ]

    return [os.path.join(data_root, f) for f in subset.filename]
