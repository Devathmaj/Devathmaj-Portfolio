# 🧠 DF-SSD: An Improved SSD Object Detection Algorithm Based on DenseNet and Feature Fusion

**Reference Paper:**
📄 *“DF-SSD: An Improved SSD Object Detection Algorithm Based on DenseNet and Feature Fusion”* (IEEE Access, DOI: [10.1109/ACCESS.2020.2971026](https://doi.org/10.1109/ACCESS.2020.2971026))
Located in this directory as `DF-SSD_An_Improved_SSD_Object_Detection_Algorithm_.pdf`.

---

## 📘 Overview

This repository implements the **DF-SSD (Dense Feature-SSD)** algorithm — an enhanced version of the **Single Shot MultiBox Detector (SSD)**.
DF-SSD improves SSD’s **small-object detection accuracy** and **feature representation** by integrating:

1. **DenseNet-S-32-1 Backbone** – replaces VGG-16 to enhance feature reuse and gradient propagation.
2. **Feature Fusion Module (FFM)** – merges multi-scale features using **atrous convolution**, **normal convolution** and **deconvolution** for rich context learning.
3. **Residual Prediction Module (ResBlock)** – improves gradient flow before classification and localization prediction heads.

This implementation follows the structure and training guidelines described in the paper, adapted for modern **PyTorch** environments and datasets in **COCO** format.

**Note:** You can run this implementation using either the **Python script** (`DF-SSD.py`) for a streamlined, script-based execution or the **Jupyter Notebook** (`DF-SSD.ipynb`) for an interactive, step-by-step experience. The notebook includes detailed comments, visualizations and allows you to run individual cells for setup, training and inference, making it ideal for experimentation and learning. Use the script for production or automated runs and the notebook for development and testing.

---

## 🏗️ Architecture Summary

The network structure mirrors **Fig. 1** of the paper:

| Component                       | Description                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Input**                       | 300 × 300 × 3 RGB image                                                                              |
| **Backbone**                    | DenseNet-S-32-1 with stem block and 4 dense stages                                                   |
| **Feature Maps**                | Conv4_Fu (38×38), Conv7_Fu (19×19), Conv8_Fu (10×10), Conv9_Fu (5×5), Conv10_2 (3×3), Conv11_2 (1×1) |
| **Feature Fusion Modules**      | Combine low, mid and high-level feature maps via atrous, standard and transpose convolutions       |
| **Residual Prediction Modules** | Add residual connections before prediction heads                                                     |
| **Prediction Heads**            | Output localization (4 values/box) and confidence scores (C × boxes)                                 |

---

## 🧩 Main Components (Code Summary)

### 🔹 `SSDAugmentation`

Applies random expansion, flipping, color jitter and resizing — following SSD’s enhanced augmentation scheme to improve small-object detection.

### 🔹 `DenseNet_S_32_1`

Custom **DenseNet-based backbone** with:

* Growth rate = 32
* Compression = 1
* 4 dense blocks and transition layers
* A **two-branch stem block** inspired by Inception-v4 for richer early features.

### 🔹 `FeatureFusion`

Implements multi-scale feature fusion using:

* **Atrous convolution** for expanded receptive field on low-level features
* **Standard convolution** for mid-level features
* **Deconvolution (ConvTranspose2d)** to upsample high-level semantic maps
* **Concatenation + 1×1 Conv** for dimension reduction.

### 🔹 `ResBlock`

Residual refinement block before each prediction head.
Improves gradient stability and detection accuracy while keeping computation light.

### 🔹 `PredictionHead`

Produces localization offsets and class confidences for each feature map scale.

### 🔹 `DefaultBoxGenerator`

Generates **default (anchor) boxes** across feature maps at varying scales and aspect ratios.

### 🔹 `iou`, `encode_boxes`, `match_priors`

Implements the **IoU calculation**, **ground-truth encoding** and **prior matching** logic for SSD training.

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/DF-SSD.git
cd DF-SSD
```

### 2️⃣ Install Dependencies

The script auto-installs most packages, but you can also install them manually:

```bash
pip install torch torchvision opencv-python matplotlib tqdm roboflow
```

### 3️⃣ Dataset Setup

This implementation uses datasets from **Roboflow** in **COCO format**:

```python
from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_API_KEY")
project = rf.workspace("your-workspace").project("your-project-name")
version = project.version(16)
dataset = version.download("coco")
```

Dataset structure example:

```
railway_monitoring_system-16/
├── train/
│   ├── image1.jpg
│   └── _annotations.coco.json
├── valid/
├── test/
└── _annotations.coco.json
```

### 4️⃣ Running the Implementation

- **Using the Jupyter Notebook (`DF-SSD.ipynb`)**: Open the notebook in Jupyter Lab or VS Code. Run the cells sequentially to install dependencies, load data, train the model and perform inference. This is recommended for interactive exploration, debugging and visualization.
- **Using the Python Script (`DF-SSD.py`)**: Execute the script directly with `python DF-SSD.py` for a non-interactive run, suitable for batch processing or deployment.

---

## 🧠 Training

### Modify Hyperparameters

Inside the notebook/script:

* Adjust batch size, learning rate and number of epochs.
* Training loop supports **COCO-style datasets**.

Example pseudo-train call:

```python
model = DF_SSD(num_classes=3).to(device)
optimizer = torch.optim.SGD(model.parameters(), lr=1e-3, momentum=0.9, weight_decay=5e-4)
```

### Data Augmentation

Implements **random expansion**, **horizontal flip** and **color jitter** to improve generalization, especially for small targets (as per SSD300* augmentation strategy).

### Loss Function

Uses combined **Localization Loss + Confidence Loss**:

```
L(x,c,l,g) = (1/N) * (L_conf(x, c) + α * L_loc(x, l, g))
```

Where:

* `L_loc`: Smooth L1 loss between predicted and ground truth boxes
* `L_conf`: Softmax loss over class confidences

### Optimization

* Optimizer: **SGD**
* Momentum: 0.9
* Weight Decay: 0.0005
* Learning Rate: 0.1 (decays every 20k iterations)
* Mini-batch: 8 (default, adjustable)
* Gradient accumulation used for large batch emulation (per paper’s DSOD method)

**Note:** You need to train this model for prolonged epochs and significant time as it is not properly optimized.

**Notebook Usage:** In `DF-SSD.ipynb`, run the training cells after setting up the dataset. The notebook includes cells for data loading, model initialization, training loop and validation, with interactive plots for loss tracking.

---

## 📊 Results (as reported in the paper)

| Dataset  | Input   | mAP (%)  | Compared to SSD | Parameters         |
| -------- | ------- | -------- | --------------- | ------------------ |
| VOC 2007 | 300×300 | **81.4** | +3.1 mAP        | ½ of SSD           |
| VOC 2012 | 300×300 | 79.0     | —               | ½ of SSD           |
| MS COCO  | 300×300 | 29.5     | —               | 1/9 of Faster-RCNN |

---

## 🧪 Evaluation Metrics

* **Mean Average Precision (mAP)**
* **IoU threshold:** 0.5
* **FPS:** Compares favorably with SSD300 while maintaining real-time detection.

---

## 🖼️ Visualization

You can visualize predictions using:

```python
import cv2
import matplotlib.pyplot as plt
```

Or directly overlay bounding boxes on test images for qualitative evaluation.

**Notebook Usage:** The `DF-SSD.ipynb` includes dedicated cells for inference and visualization, allowing you to load a trained model, run predictions on sample images and display results with bounding boxes and class labels interactively.

---

## 📂 Directory Structure

```
DF-SSD/
├── DF-SSD.py                      # Full implementation as a Python script for batch execution
├── DF-SSD.ipynb                   # Jupyter Notebook version with interactive cells, comments and visualizations
├── DF-SSD_An_Improved_SSD_Object_Detection_Algorithm_.pdf  # Reference paper
├── README.md                      # This file
└── datasets/                      # (Optional) COCO-format datasets
```

---

## 🚀 Key Advantages over Standard SSD

| Feature                | DF-SSD            | Standard SSD |
| ---------------------- | ----------------- | ------------ |
| Backbone               | DenseNet-S-32-1   | VGG-16       |
| Feature Fusion         | Yes (multi-scale) | No           |
| Residual Prediction    | Yes               | No           |
| Small Object Detection | ✅ Excellent       | ⚠️ Weak      |
| Parameters             | ½ of SSD          | Full         |
| Accuracy (VOC 2007)    | 81.4 mAP          | 78.3 mAP     |

---

## 💡 References

* Zhai, S., Shang, D., Wang, S., & Dong, S. (2020).
  *DF-SSD: An Improved SSD Object Detection Algorithm Based on DenseNet and Feature Fusion.*
  **IEEE Access**, DOI: 10.1109/ACCESS.2020.2971026.
  Licensed under **Creative Commons Attribution 4.0**.

---

## 🧾 License

This implementation is provided for **academic and research use** only, in accordance with the **CC BY 4.0 License** of the original paper.
See [Creative Commons License](https://creativecommons.org/licenses/by/4.0/) for details.

---

## 🙌 Acknowledgments

* Original authors of DF-SSD paper (Xi’an University of Posts and Telecommunications).
* PyTorch team for open-source deep learning framework.
* Roboflow for dataset tools and integration.

