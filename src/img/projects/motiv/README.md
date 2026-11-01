# Motiv - A Supportive Discord Bot

Created in late 2023 | Updated May 2024

A supportive Discord bot that detects sad or down messages and responds with uplifting, AI-generated encouragement.

---

## Features ✨

- 🧠 **AI-Powered Mood Detection**: Uses DeepSeek (via OpenRouter) to intelligently detect sadness in messages.
- 💬 **Personalized Comfort**: Generates unique, motivational responses based on the user's message.
- 멘 **User Mentions**: Pings the user directly to offer personalized support.
- 🤖 **No Commands Needed**: The bot listens and responds automatically in all channels where it has permissions.

---

## Getting Started 🚀

### Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/)
- A Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications)
- An [OpenRouter API Key](https://openrouter.ai/)

### Installation & Running the Bot

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Motiv-Discord-bot.git
    cd Motiv-Discord-bot
    ```

2.  **Create and configure your environment file:**
    - Rename the `.env.example` file to `.env`.
    - Open the `.env` file and add your Discord Bot Token and OpenRouter API Key.

3.  **Build and run the bot using Docker Compose:**
    ```bash
    docker-compose up --build
    ```
    The bot should now be online and running in your server.

---

## Configuration ⚙️

Create a `.env` file in the project root with the following variables:

```ini
DISCORD_TOKEN=your_discord_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### Required Discord Bot Permissions

When inviting your bot to a server, ensure you grant it the following permissions:

- `Send Messages`
- `Read Message History`
- `View Channels`

You also need to enable the **Message Content Intent** in your bot's settings on the Discord Developer Portal.

---

## How It Works 🔍

The bot listens to all messages in the channels it can access. Each message is processed as follows:

1.  **Mood Detection**: The message content is sent to the DeepSeek model via the OpenRouter API to determine if the sentiment is sad.
2.  **Uplifting Response**: If sadness is detected, a second API call generates a unique and comforting message.
3.  **Send Message**: The bot sends the uplifting message, mentioning the original author.

If the message is not detected as sad, the bot remains silent.

---

## Example 💬

**User:** "I'm having a really tough day..."

**Bot:** "@user Remember, even the darkest nights end with sunrise ☀️. You're not alone!"

---

## Troubleshooting 🛠️

| Issue                      | Solution                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `400 Bad Request`          | Double-check that your OpenRouter API key is valid and has sufficient credits.                  |
| `Missing Privileged Intents` | Enable the "Message Content Intent" in the Discord Developer Portal for your bot.               |
| Bot is offline             | Check the Docker container logs (`docker-compose logs -f`) for any error messages.              |
| Bot not responding         | Ensure the bot has the required permissions (`Send Messages`, `Read Message History`) in the channel. |
| `API Rate Limit (Error 429)` | You may be exceeding your API quota. Check your OpenRouter account for usage details.           |

---

## Notes 📌

- This bot is intended for supportive purposes only and is not a substitute for professional mental health care.
- Always monitor and moderate your server environment when using AI-powered bots.
- Contributions are welcome! Feel free to open an issue or submit a pull request.
