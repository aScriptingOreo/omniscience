# Omniscience Bot

Omniscience is a Discord bot built using Node.js, `discord.js`, `sqlite3`, and `dotenv`. The bot provides a single functionality, bridging messages between discord servers.

## Features

- **Register Channels**: Register a channel with a password and a custom guild name.
- **Unregister Channels**: Unregister a channel using the password.
- **Message Bridging**: Bridge messages between channels that share the same password.
- **Admin Commands**: Only users with admin permissions can execute commands.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- SQLite3

## Installation

1. Clone the repository:

```sh
git clone https://github.com/aScriptingOreo/omniscience.git
cd omniscience
npm install
