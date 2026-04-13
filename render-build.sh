#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Installation des bibliothèques Python
pip install -r requirements.txt

# 2. Installation de Chrome via Pyppeteer (méthode autorisée sur Render)
python -c "import pyppeteer; pyppeteer.chromium_downloader.download_chromium()"