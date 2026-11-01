# 🤖 OwO Winning Tracker Discord Bot

[![Python](https://img.shields.io/badge/Python-3.9-blue.svg)](https://www.python.org/downloads/release/python-390/)
[![discord.py](https://img.shields.io/badge/discord.py-2.3.2-7289DA.svg)](https://github.com/Rapptz/discord.py)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4-47A248.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-20.10-blue.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful Discord bot designed to meticulously track and analyze mini-game results from the popular OwO bot. It automatically monitors game outcomes for coinflips, blackjack and slots, providing detailed statistics on wins, losses and net profit.

---

## ✨ Features

-   **Automatic Game Tracking**: Monitors channels for OwO bot messages related to `coinflip`, `blackjack` and `slots`.
-   **Detailed Statistics**: Accurately parses messages and embeds to calculate bets, wins, losses and net gain.
-   **Session-Based Analysis**: Tracks statistics within distinct sessions, initiated and concluded by user commands.
-   **Persistent Storage**: Saves session results to a MongoDB database for long-term analysis.
-   **Containerized & Easy to Deploy**: Comes with a `Dockerfile` and `docker-compose.yml` for quick and easy setup.
-   **Robust Error Handling**: Gracefully handles various game outcomes, including ties, busts and ignored rounds.

---

## 🛠️ Tech Stack

-   **Backend**: Python 3.9
-   **Discord API Wrapper**: `discord.py`
-   **Database**: MongoDB
-   **Containerization**: Docker & Docker Compose
-   **Dependencies**: `pymongo`, `python-dotenv`

---

## 🚀 Getting Started

You can run this project using either Docker (recommended for ease of use) or by setting up a local development environment.

### Prerequisites

-   [Git](https://git-scm.com/)
-   [Docker](https://docs.docker.com/get-docker/)
-   [Docker Compose](https://docs.docker.com/compose/install/)
-   A Discord Bot Token and Application ID.

### 1. Docker Setup (Recommended)

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/Devathmaj/OwO-winning-tracker.git
    cd OwO-winning-tracker
    ```

2.  **Configure Environment Variables:**
    Create a `.env` file and add your Discord Bot Token.
    ```env
    DISCORD_TOKEN=your_discord_bot_token_here
    ```

3.  **Build and Run the Containers:**
    ```sh
    docker-compose up --build -d
    ```

### 2. Local Development Setup

1.  **Clone the repository and navigate to the directory.**
2.  **Start MongoDB** using `docker-compose up -d mongo` or your own instance.
3.  **Configure `.env`** with `DISCORD_TOKEN` and `MONGO_URI=mongodb://localhost:27017/`.
4.  **Create a Python virtual environment** and activate it.
5.  **Install dependencies:** `pip install -r requirements.txt`.
6.  **Run the bot:** `python bot_track.py`.

---

## ✉️ Bot Invitation

To add the bot to your Discord server, you must create an invitation link.

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications) and select your application.
2.  Navigate to the **OAuth2 -> URL Generator** tab.
3.  Select the following scopes:
    -   `bot`
    -   `applications.commands`
4.  Select the following bot permissions:
    -   `Send Messages`
    -   `Read Message History`
    -   `View Channels`
5.  Copy the generated URL and open it in your browser to invite the bot to your desired server.

---

## ⚙️ Configuration

-   `DISCORD_TOKEN` (Required): Your Discord application's bot token.
-   `MONGO_URI` (Required for local setup): The connection string for your MongoDB database.

---

## 📝 Usage

-   `/initialize`: Starts a new tracking session in the channel.
-   `/result`: Ends the session, displays a summary and saves it to the database.

---

## 🔍 Troubleshooting

-   **Bot is offline:**
    -   Check the container logs with `docker-compose logs -f bot`.
    -   Ensure your `DISCORD_TOKEN` is correct in the `.env` file.
    -   Verify that the Docker containers are running with `docker-compose ps`.
-   **Slash commands not appearing:**
    -   It can take Discord up to an hour to register slash commands globally. Try reinviting the bot to your server with the correct OAuth2 URL.
    -   Ensure the bot was invited with the `applications.commands` scope.
-   **Data not being tracked:**
    -   Confirm the bot has `Read Message History` and `View Channels` permissions in the target channel.
    -   Make sure you have started a session with `/initialize`.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

## 📞 Contact

Developed by [Devathmaj](https://github.com/Devathmaj).

*Disclaimer: This bot is a third-party tool and is not affiliated with the OwO bot or Discord.*