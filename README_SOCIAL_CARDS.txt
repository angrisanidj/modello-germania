MODEL-GENERATED SOCIAL CARDS

The dashboard itself renders the social images from the current model state.
GitHub Actions opens index.html, waits for the Monte Carlo, then calls window.socialCardDataUrl().

Generated assets:
- social-card-bundestag-v2.png (1200x630; X, Threads, Facebook, LinkedIn, Telegram, WhatsApp and main-page OG/Twitter metadata)
- social-card-bundestag-instagram-v2.png (1080x1350; Instagram 4:5)

The workflow also refreshes the cache-buster in share-*.html and the main index.html social-image metadata.
It runs twice daily, manually, and after relevant model/share-code changes.
