# Use Bun official image
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with Bun
RUN bun install

# Copy the rest of the application
COPY . .

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Default command (can be overridden by docker-compose)
CMD ["bun", "run", "dev"]
