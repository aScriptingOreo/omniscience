# Omniscience Bot

Omniscience is a Discord bot built using Node.js, `discord.js`, `sqlite3`, and `dotenv`. The bot provides a single functionality, bridging messages between discord servers.

## Features

- **Register Channels**: Register a channel with a password and a custom guild name.
- **Unregister Channels**: Unregister a channel using the password.
- **Message Bridging**: Bridge messages between channels that share the same password.
- **Admin Commands**: Only users with admin permissions can execute commands.

## Using Docker

You can use Docker to run the bot. Here is an example `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  omniscience-bot:
    build: .
    container_name: omniscience-bot
    env_file:
      - .env
    ports:
      - "3000:3000"
    restart: unless-stopped
```
