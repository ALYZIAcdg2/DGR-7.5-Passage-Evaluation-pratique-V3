#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python -c "import pyppeteer; pyppeteer.chromium_downloader.download_chromium()"