---
title: DF-SSD
abstract: PyTorch implementation of DF-SSD, combining a DenseNet-S-32-1 backbone and multi-scale feature fusion for improved small-object detection.
categories:
  - computer vision
  - deep learning
  - pytorch
  - research
publishDate: 2026-01-10T12:00-00:00
workOrder: 8
projectStyle: system
isFeatured: false
theme:
  fill: '#123c4a'
  accent: '#123c4a'
  contrast: '#fff'
cover: /img/projects/df-ssd/df-ssd-github.png
coverAlt: DF-SSD on GitHub
repo: https://github.com/Devathmaj/DF-SSD
highlights:
  - value: 81.4 mAP
    label: Pascal VOC at 300x300
  - value: +3.1 pts
    label: Improvement over SSD
  - value: 1/9
    label: Faster R-CNN parameters
---

![DF-SSD on GitHub](/img/projects/df-ssd/df-ssd-github.png)

## Overview

DF-SSD is a PyTorch implementation of the Dense Feature SSD object detection algorithm described in the IEEE Access paper *DF-SSD: An Improved SSD Object Detection Algorithm Based on DenseNet and Feature Fusion*. The implementation follows the paper's architecture and training guidelines while adapting them for modern PyTorch environments and COCO-format datasets.

Standard SSD is fast and simple, but its VGG-16 backbone and single-scale prediction heads struggle with small objects. DF-SSD addresses both weaknesses by improving feature reuse in the backbone and fusing information across multiple scales before prediction.

## Architecture

The network mirrors the structure described in the paper.

- **Backbone:** DenseNet-S-32-1 with growth rate 32, four dense stages, transition layers and a two-branch stem block inspired by Inception-v4.
- **Feature maps:** Conv4_Fu at 38×38, Conv7_Fu at 19×19, Conv8_Fu at 10×10, Conv9_Fu at 5×5, Conv10_2 at 3×3 and Conv11_2 at 1×1.
- **Feature Fusion Modules:** Low-level maps pass through atrous convolution, mid-level maps through standard convolution and high-level maps through deconvolution. The results are concatenated and reduced with a 1×1 convolution.
- **Residual Prediction Modules:** A residual refinement block sits before each classification and localisation head to improve gradient flow and detection accuracy.
- **Prediction heads:** Each scale outputs four localisation values per box and confidence scores for every class.

The implementation includes the supporting pieces needed to train the model: default box generation, IoU calculation, ground-truth box encoding and prior matching.

![DF-SSD architecture](/img/projects/df-ssd/df-ssd-architecture.png)

## Training and evaluation

The model is trained on COCO-format data, with the option to pull datasets through Roboflow. The repository provides both a Python script for batch or production runs and a Jupyter notebook for interactive experimentation, visualisation and step-by-step debugging.

Training uses SGD with momentum 0.9 and weight decay 0.0005, a learning rate that decays every 20,000 iterations and a combined localisation and confidence loss. Data augmentation includes random expansion, horizontal flips, colour jitter and resizing, following SSD's enhanced augmentation strategy. Gradient accumulation is used to emulate larger batches.

Evaluation uses mean average precision at an IoU threshold of 0.5, with FPS considered alongside accuracy because the model is intended to remain a real-time detector.

## Results

I’m unable to provide an actual detection image because I no longer have access to the trained model. It was saved on a drive associated with an account I can no longer access, so the values presented are based on theoretical estimates and reported results.

The paper reports strong improvements over the original SSD while using a fraction of the parameters.

- Pascal VOC test set at 300×300: **81.4 mAP**, a 3.1 point improvement over SSD
- Pascal VOC validation set at 300×300: **79.0 mAP**
- MS COCO at 300×300: **29.5 mAP**
- Parameter count: roughly one ninth of Faster R-CNN

![DF-SSD at a glance](/img/projects/df-ssd/df-ssd-summary.png)

The implementation is provided for academic and research use, in line with the CC BY 4.0 licence of the original paper.

## Stack

Python, PyTorch, Torchvision, OpenCV, NumPy, Jupyter, Roboflow, COCO.

## Codebase

[View DF-SSD on GitHub](https://github.com/Devathmaj/DF-SSD)
