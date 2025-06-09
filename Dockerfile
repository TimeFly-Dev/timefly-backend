# Stage 1: Builder
# Use the standard Bun image for building the application.
FROM oven/bun:1 AS builder
WORKDIR /usr/src/app

# Copy package files and install all dependencies (including devDependencies for the build process).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the application source code.
COPY . .

# Build the application. Output is expected in './build' as per package.json.
RUN bun run build

# Stage 2: Final Image
# Use the lightweight Alpine-based Bun image for the final production image.
FROM oven/bun:1-alpine AS final
WORKDIR /usr/src/app

# Copy only the built application from the builder stage.
# node_modules are not copied as 'bun build --target bun' should bundle dependencies.
COPY --from=builder /usr/src/app/build ./build

# Optionally, copy package.json if your app needs to read it at runtime (e.g., for version).
COPY --from=builder /usr/src/app/package.json .

# Set non-root user, expose port, and define the entrypoint.
USER bun
EXPOSE 3001/tcp
ENTRYPOINT [ "bun", "run", "./build/index.js" ]