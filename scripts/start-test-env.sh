#!/bin/bash

# Testiympäristön käynnistysskripti

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"
SESSION_NAME="test-env"

# Tarkista että tmux on asennettu
if ! command -v tmux &> /dev/null; then
    echo "Virhe: tmux ei ole asennettu (sudo apt install tmux)"
    exit 1
fi

# Tarkista että Docker on käynnissä
if ! docker info &> /dev/null; then
    echo "Virhe: Docker ei ole käynnissä"
    exit 1
fi

# Luo .env.test jos sitä ei ole
ENV_FILE="$BACKEND_DIR/.env.test"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << 'EOF'
DATABASE_PORT=5434
DATABASE_USER=sami
DATABASE_HOST=localhost
DATABASE_PASSWORD=secret
DATABASE_NAME=groceries
SECRET=SECRET
POSTGRES_PASSWORD=secret
POSTGRES_USER=sami
POSTGRES_DB=groceries
DATABASE_URL=postgresql://sami:secret@localhost:5434/groceries
EOF
fi

# Kysy haluaako käyttäjä käynnistää appin emulaattorille
echo -n "Avataanko appi emulaattorille? (k/e): "
read -r ANSWER

# Tapa vanha sessio jos on olemassa
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

cd "$BACKEND_DIR"

# Käynnistä test-sql ja test-server
tmux new-session -d -s "$SESSION_NAME" -c "$BACKEND_DIR" "npm run test-sql"
tmux split-window -h -t "$SESSION_NAME" -c "$BACKEND_DIR" "sleep 5 && npm run test-server"

if [ "$ANSWER" = "k" ] || [ "$ANSWER" = "K" ]; then
    export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
    export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools

    AVDS=$(emulator -list-avds 2>/dev/null)
    AVD_COUNT=$(echo "$AVDS" | wc -l)

    if [ "$AVD_COUNT" -eq 1 ]; then
        SELECTED_AVD="$AVDS"
    else
        echo "Emulaattorit:"
        i=1
        while IFS= read -r avd; do
            echo "  $i) $avd"
            ((i++))
        done <<< "$AVDS"
        echo -n "Valitse (1-$AVD_COUNT): "
        read -r AVD_NUM
        SELECTED_AVD=$(echo "$AVDS" | sed -n "${AVD_NUM}p")
    fi

    # Käynnistä emulaattori
    tmux select-pane -t "$SESSION_NAME:0.0"
    tmux split-window -v -t "$SESSION_NAME" "emulator -avd $SELECTED_AVD -gpu host"

    # Käynnistä frontend
    WAIT_SCRIPT="$SCRIPT_DIR/wait-for-emulator.sh"
    tmux new-window -t "$SESSION_NAME" -n "frontend" -c "$FRONTEND_DIR" "$WAIT_SCRIPT 30 'npx expo run:android -d $SELECTED_AVD'"
fi

tmux attach-session -t "$SESSION_NAME"
