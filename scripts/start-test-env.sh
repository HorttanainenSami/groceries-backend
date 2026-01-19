#!/bin/bash

# Testiympäristön käynnistysskripti
# Käyttää tmuxia jakamaan terminaalin kahteen ikkunaan

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"
SESSION_NAME="test-env"
START_EMULATOR=false
START_USB=false

# Värit
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "Tarkistetaan riippuvuudet..."

# Tarkista että tmux on asennettu
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Virhe: tmux ei ole asennettu${NC}"
    echo "Asenna: sudo apt install tmux"
    exit 1
fi

# Tarkista että Docker on käynnissä
if ! docker info &> /dev/null; then
    echo -e "${RED}Virhe: Docker ei ole käynnissä${NC}"
    echo "Käynnistä Docker ja yritä uudelleen"
    exit 1
fi

echo -e "${GREEN}Docker on käynnissä${NC}"

# Luo .env.test jos sitä ei ole
ENV_FILE="$BACKEND_DIR/.env.test"
if [ ! -f "$ENV_FILE" ]; then
    echo "Luodaan .env.test tiedosto..."
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
    echo -e "${GREEN}.env.test luotu${NC}"
else
    echo -e "${GREEN}.env.test löytyy jo${NC}"
fi

# Aseta Android SDK polut
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
export JAVA_HOME=${JAVA_HOME:-/opt/android-studio/jbr}
export PATH=$PATH:$JAVA_HOME/bin

# Kysy haluaako käyttäjä käynnistää frontendin
if [ -d "$FRONTEND_DIR" ]; then
    AVDS=$(emulator -list-avds 2>/dev/null)
    USB_DEVICE=$(adb devices 2>/dev/null | grep -v "emulator" | grep "device$" | head -1 | awk '{print $1}')

    if [ -n "$AVDS" ] || [ -n "$USB_DEVICE" ]; then
        echo ""
        echo -e "${YELLOW}Mille laitteille haluat käynnistää frontendin?${NC}"
        echo "  1) Vain emulaattori"
        echo "  2) Vain USB-laite"
        echo "  3) Molemmat"
        echo "  4) Ei kumpaakaan"
        echo -n "Valitse (1-4): "
        read -r DEVICE_CHOICE
        echo ""

        case $DEVICE_CHOICE in
            1)
                START_EMULATOR=true
                ;;
            2)
                START_USB=true
                ;;
            3)
                START_EMULATOR=true
                START_USB=true
                ;;
            *)
                ;;
        esac

        # Jos emulaattori valittu, kysy mikä
        if [ "$START_EMULATOR" = true ] && [ -n "$AVDS" ]; then
            echo "Saatavilla olevat emulaattorit:"
            i=1
            while IFS= read -r avd; do
                echo "  $i) $avd"
                ((i++))
            done <<< "$AVDS"

            AVD_COUNT=$(echo "$AVDS" | wc -l)
            if [ "$AVD_COUNT" -eq 1 ]; then
                SELECTED_AVD="$AVDS"
                echo -e "${GREEN}Valitaan ainoa emulaattori: $SELECTED_AVD${NC}"
            else
                echo -n "Valitse emulaattori (1-$AVD_COUNT): "
                read -r AVD_NUM
                SELECTED_AVD=$(echo "$AVDS" | sed -n "${AVD_NUM}p")
            fi
        fi

        # Jos USB valittu, tallenna laite (käytä mallinimeä Expolle, sarjanumeroa adb:lle)
        if [ "$START_USB" = true ] && [ -n "$USB_DEVICE" ]; then
            USB_SERIAL="$USB_DEVICE"
            USB_MODEL=$(adb -s "$USB_DEVICE" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
            SELECTED_USB="$USB_MODEL"
            echo -e "${GREEN}USB-laite: $USB_MODEL ($USB_SERIAL)${NC}"
        elif [ "$START_USB" = true ] && [ -z "$USB_DEVICE" ]; then
            echo -e "${RED}USB-laitetta ei löytynyt${NC}"
            START_USB=false
        fi

    fi
fi

# Tapa vanha sessio jos on olemassa
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

echo "Käynnistetään tmux-sessio..."

# Luo uusi tmux sessio ja jaa se vertikaalisesti
cd "$BACKEND_DIR"

# Luo sessio ja käynnistä test-sql vasemmassa paneelissa
tmux new-session -d -s "$SESSION_NAME" -c "$BACKEND_DIR" "npm run test-sql"

# Jaa ikkuna vertikaalisesti ja odota hetki ennen test-serverin käynnistystä
tmux split-window -h -t "$SESSION_NAME" -c "$BACKEND_DIR" "sleep 5 && npm run test-server"

# Käynnistä emulaattori jos valittu
if [ "$START_EMULATOR" = true ] && [ -n "$SELECTED_AVD" ]; then
    # Jaa vasen paneeli (test-sql) horisontaalisesti emulaattorille
    tmux select-pane -t "$SESSION_NAME:0.0"
    tmux split-window -v -t "$SESSION_NAME" "emulator -avd $SELECTED_AVD -gpu host"
    echo -e "${GREEN}Emulaattori käynnistetään: $SELECTED_AVD${NC}"
fi

# Käynnistä frontend jos emulaattori tai USB valittu
if [ "$START_EMULATOR" = true ] || [ "$START_USB" = true ]; then
    WAIT_SCRIPT="$SCRIPT_DIR/wait-for-emulator.sh"

    # APK-polku
    APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

    # Luo frontend-ikkuna
    if [ "$START_EMULATOR" = true ] && [ "$START_USB" = true ]; then
        # Molemmat - yksi build, sitten asennetaan USB:lle
        # Luo USB-asennusskripti joka ajetaan buildin jälkeen
        USB_INSTALL_SCRIPT="$SCRIPT_DIR/install-usb.sh"
        cat > "$USB_INSTALL_SCRIPT" << USBEOF
#!/bin/bash
export ANDROID_HOME=\${ANDROID_HOME:-\$HOME/Android/Sdk}
export PATH=\$PATH:\$ANDROID_HOME/platform-tools
echo -e '\033[0;32mPoistetaan vanha versio...\033[0m'
adb -s $USB_SERIAL uninstall com.imasami.groceries 2>/dev/null || true
echo -e '\033[0;32mAsennetaan USB-laitteelle ($USB_SERIAL)...\033[0m'
adb -s $USB_SERIAL install -r $APK_PATH
echo -e '\033[0;32mValmis! Avaa sovellus laitteella.\033[0m'
echo ''
echo -e '\033[0;33mPaina Enter sulkeaksesi.\033[0m'
read
USBEOF
        chmod +x "$USB_INSTALL_SCRIPT"

        # Emulaattori-pane: build ja sen jälkeen avaa USB-pane
        tmux new-window -t "$SESSION_NAME" -n "frontend" -c "$FRONTEND_DIR" "$WAIT_SCRIPT 30 'npx expo run:android -d $SELECTED_AVD && tmux split-window -h -t $SESSION_NAME:frontend -c $FRONTEND_DIR $USB_INSTALL_SCRIPT'"
        echo -e "${GREEN}Frontend rakennetaan kerran, asennetaan molemmille${NC}"
    elif [ "$START_EMULATOR" = true ]; then
        # Vain emulaattori
        tmux new-window -t "$SESSION_NAME" -n "frontend" -c "$FRONTEND_DIR" "$WAIT_SCRIPT 30 'npx expo run:android -d $SELECTED_AVD'"
        echo -e "${GREEN}Frontend käynnistetään emulaattorille${NC}"
    elif [ "$START_USB" = true ]; then
        # Vain USB
        tmux new-window -t "$SESSION_NAME" -n "frontend" -c "$FRONTEND_DIR" "npx expo run:android -d $SELECTED_USB; echo ''; echo -e '\033[0;33mProsessi päättyi. Paina Enter.\033[0m'; read"
        echo -e "${GREEN}Frontend käynnistetään USB-laitteelle${NC}"
    fi
fi

# Liity sessioon
tmux attach-session -t "$SESSION_NAME"
