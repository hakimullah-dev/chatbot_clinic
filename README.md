# Chatbot Frontend

Static frontend for live testing the `Online Appointment System` workflow on GitHub Pages.

## Files

- `index.html` - UI shell
- `styles.css` - visual design and responsive layout
- `app.js` - webhook integration, session storage, slot picker, and audio playback

## How To Use

1. Open `chatbot-frontend/index.html` locally or publish the folder with GitHub Pages.
2. Keep the webhook URL pointed to your live n8n production webhook.
3. Use quick prompts or type your own booking, cancel, or reschedule messages.
4. The app stores `session_id`, `history`, and the last audio response in browser storage.

## GitHub Pages

If this repo is pushed to GitHub:

1. Commit the `chatbot-frontend` folder.
2. In GitHub, open `Settings -> Pages`.
3. Choose the branch and set the folder to `/chatbot-frontend` if available, or move these files to the publishing root if needed.
4. Save and use the generated Pages URL for live testing.
