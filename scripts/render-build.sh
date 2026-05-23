#!/bin/bash
set -e

echo "→ Installing pnpm..."
npm install -g pnpm

echo "→ Installing dependencies..."
pnpm install

echo "→ Building frontend..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/sky-official run build

echo "→ Building API server..."
pnpm --filter @workspace/api-server run build

echo "→ Build complete."
