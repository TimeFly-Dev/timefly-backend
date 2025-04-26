# use the official Bun image
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# copy all project files into the image
COPY . .

# [optional] run tests
ENV NODE_ENV=production
RUN bun test

# run the app
USER bun
EXPOSE 3001/tcp
ENTRYPOINT [ "bun", "run", "src/index.ts" ]