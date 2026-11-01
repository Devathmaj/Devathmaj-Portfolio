# 🚀 Feature-Rich Discord Bot

[![Python Version](https://img.shields.io/badge/python-3.10-blue.svg)](https://www.python.org/downloads/release/python-3100/)
[![discord.py](https://img.shields.io/badge/discord.py-2.3.2-blue.svg)](https://github.com/Rapptz/discord.py)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, modular and feature-rich Discord bot built with Python, `discord.py` and containerized with Docker.

## ✨ Features

This bot comes packed with a variety of commands and features, organized into cogs for easy management and scalability.

- **👋 Greeter**: Automatically welcomes new members to the server.
- **🤣 Fun**:
  - `/ping`: Checks the bot's latency.
  - `/joke`: Fetches a random programming joke from a public API.
- **ℹ️ Information**:
  - `/userinfo [member]`: Displays detailed information about a server member.
  - `/serverinfo`: Displays detailed information about the server.
- **🛡️ Moderation**:
  - `/kick <member> [reason]`: Kicks a member from the server (requires "Kick Members" permission).
  - `/ban <member> [reason]`: Bans a member from the server (requires "Ban Members" permission).

## 🛠️ Project Structure

The bot is designed with a clean and scalable structure, making it easy to add new features.

```
Project/
├── cogs/
│   ├── fun.py
│   ├── greeter.py
│   ├── info.py
│   └── moderation.py
├── .env
├── .gitignore
├── bot.py
├── Dockerfile
├── docker-compose.yml
├── README.md
└── requirements.txt
```

- **`bot.py`**: The main entry point that loads cogs and runs the bot.
- **`cogs/`**: Contains the different modules (cogs) of the bot.
- **`Dockerfile` & `docker-compose.yml`**: For building and running the bot in a Docker container.
- **`.env`**: Stores the bot's token and other secrets.
- **`requirements.txt`**: Lists the Python dependencies.

---

## 🐳 Getting Started with Docker (Recommended)

Running the bot with Docker is the easiest and recommended method.

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repository-name.git
    cd your-repository-name/Project
    ```

2.  **Create the environment file:**
    Create a `.env` file in the `Project` directory and add your bot token.
    ```env
    DISCORD_TOKEN=your_bot_token_here
    ```

3.  **Build and run the container:**
    ```bash
    docker-compose up --build -d
    ```
    The `-d` flag runs the container in detached mode.

4.  **To stop the bot:**
    ```bash
    docker-compose down
    ```

---

## 🐍 Local Python Setup (Without Docker)

### Prerequisites

- Python 3.10+

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repository-name.git
    cd your-repository-name/Project
    ```

2.  **Create a virtual environment and activate it:**
    ```bash
    # For Windows
    python -m venv venv
    venv\Scripts\activate

    # For macOS/Linux
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create the environment file:**
    Create a `.env` file in the `Project` directory and add your bot token.
    ```env
    DISCORD_TOKEN=your_bot_token_here
    ```

5.  **Run the bot:**
    ```bash
    python bot.py
    ```

## 🤝 Contributing

Contributions, issues and feature requests are welcome! Feel free to check the [issues page](https://github.com/your-username/your-repository-name/issues).

## 📜 License

This project is licensed under the MIT License - see the [LICENSE.md](https://opensource.org/licenses/MIT) file for details.