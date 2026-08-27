#!/usr/bin/env bash
set -euo pipefail

git rm -- \
  data/AGGIUNGI_QUI_I_DUE_FILE.txt \
  LEGGIMI-v0.4.md \
  README_COMMIT.md \
  README_COMMIT_MANUALE.md \
  README_INTEGRAZIONE.md \
  README_SOCIAL.md \
  README_social_cards.txt \
  card_facebook.png \
  card_linkedin.png \
  card_telegram.png \
  card_threads.png \
  card_whatsapp.png \
  card_x.png \
  preview-bundestag-v21.png \
  preview-bundestag-v22.png \
  preview-bundestag.png \
  share-x-v2.html \
  social-card-bundestag-model.png

git status --short
echo "Review the list above, then commit and push."
