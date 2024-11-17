# Use the official Node.js 20 image as the base image
FROM node:20

# Create and set the working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies using bun
RUN npm install -g bun
RUN bun i

# Copy the rest of the application code
COPY . .

# Command to run the bot
CMD ["bun", "index.js"]