# 🎨 pixelwars.xecut.me

PixelWars is a collaborative pixel art battlefield powered by **Deno**, **WebSockets**, and **Telegram authentication**.  
Users can join the game, draw pixels on a shared canvas, and watch the artwork evolve in real time.

---

## 🚀 Features
- **Shared Canvas**: A global pixel board where all connected users can draw.
- **Real-Time Updates**: WebSocket-based synchronization between all players.
- **Access Control**: 
  - **Read-Only** for guests.
  - **Read-Write** for authenticated users (via Telegram bot).
- **Persistence**: Pixel state is stored in `/data/pixels.bin` and periodically snapshotted.
- **Auto-Reconnect**: Clients reconnect if the WebSocket drops.
- **Telegram Integration**:
  - Bot checks membership in a Telegram group.
  - Provides unique `secret_token` links for verified users.
  - Guests are redirected to a group invite link.

---

## 📦 Installation

### Requirements
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/)
- A Telegram bot token (`PIXELWARS_API_KEY`)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/pixelwars.git
cd pixelwars
````

### 2. Set environment variable

Create a `.env` file:

```ini
PIXELWARS_API_KEY=your-telegram-bot-token
```

### 3. Run with Docker Compose

```bash
docker-compose up -d
```

The service will be available at [http://localhost:8080](http://localhost:8080).

---

## 🛠 Development (without Docker)

You can run directly with **Deno** if you prefer:

```bash
deno run --allow-all main.js
```

---

## 📂 Project Structure

```
.
├── Dockerfile         # Container setup (Deno runtime)
├── docker-compose.yml # Orchestration + persistence
├── main.js            # Main server & client logic
└── README.md          # This file
```

---

## 🖼️ How It Works

1. Open the canvas in your browser:

   ```
   http://localhost:8080
   ```

2. By default, you are in **read-only mode**.
   To draw pixels:

   * Start a private chat with the Telegram bot: [@pixelwars_xecut_bot](https://t.me/pixelwars_xecut_bot).
   * If you’re a member of the group, the bot gives you a unique access link:

     ```
     http://pixelwars.xecut.me/?secret_token=xxxx-xxxx-xxxx
     ```
   * Open the link → you’re now in **read-write mode**.

3. Draw pixels with your mouse or touchscreen.

---

## 🔒 Security

* All pixel modifications require a valid `secret_token`.
* Tokens are bound to Telegram users.
* Server runs under a non-root user (`deno:deno`) with `no-new-privileges`.
