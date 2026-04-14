#!/usr/bin/env bash
set -o errexit

# Installation des dépendances listées dans requirements.txt
pip install -r requirements.txt

# Téléchargement de Chromium pour le PDF
python -c "import pyppeteer; pyppeteer.chromium_downloader.download_chromium()"