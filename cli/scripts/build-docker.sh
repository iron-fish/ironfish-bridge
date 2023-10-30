#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building Docker Image"

export DOCKER_BUILDKIT=1

docker build . \
    --progress plain \
    --tag ironfish-bridge-cli:latest \
    --file Dockerfile \
    --network host

docker run \
    --interactive \
    --rm \
    ironfish-bridge-cli:latest --version
