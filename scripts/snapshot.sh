#!/bin/bash
set -a
source ~/groceries-backend/.env.dev
set +a

set -e

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
SNAPSHOT_DIR="$HOME/backups"
SNAPSHOT_FILE="$SNAPSHOT_DIR/$TIMESTAMP/backup-$TIMESTAMP.sql"
VERSION_FILE="$SNAPSHOT_DIR/$TIMESTAMP/version-$TIMESTAMP.txt"

mkdir -p "$SNAPSHOT_DIR"
mkdir -p "$SNAPSHOT_DIR/$TIMESTAMP"

if ! docker info &> /dev/null; then
    echo "Error: Docker is not running"
    exit 1
fi

docker exec groceries-postgres-container pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$SNAPSHOT_FILE"
cat ~/groceries-backend/current-version.txt > "$VERSION_FILE"
