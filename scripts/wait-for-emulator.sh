#!/bin/bash

# Odotusscripti emulaattorille - näyttää loaderin ja voi ohittaa Enterillä

# Varmista Android SDK ja Java ympäristömuuttujat
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin
export JAVA_HOME=${JAVA_HOME:-/opt/android-studio/jbr}
export PATH=$PATH:$JAVA_HOME/bin

WAIT_TIME=${1:-30}
EXPO_CMD=${2:-"npx expo start --android"}

YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}Odotetaan emulaattorin käynnistymistä...${NC}"
echo -e "Paina ${GREEN}Enter${NC} ohittaaksesi odotuksen"
echo ""

# Spinner-merkit
SPINNER="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

for ((i=WAIT_TIME; i>0; i--)); do
    # Laske spinner-indeksi
    spin_idx=$(( (WAIT_TIME - i) % ${#SPINNER} ))
    spin_char="${SPINNER:$spin_idx:1}"

    # Näytä loader
    printf "\r${spin_char} Käynnistetään ${i} sekunnin kuluttua... "

    # Odota 1 sekunti, tarkista Enter
    if read -t 1 -n 1 key 2>/dev/null; then
        if [[ $key == "" ]]; then
            echo ""
            echo -e "${GREEN}Ohitettu! Käynnistetään nyt...${NC}"
            break
        fi
    fi
done

echo ""
# Odota että emulaattori on täysin käynnistynyt (adb näkee sen)
echo -e "${YELLOW}Odotetaan että emulaattori on valmis...${NC}"
while ! adb devices 2>/dev/null | grep -q "emulator.*device$"; do
    printf "."
    sleep 2
done
echo ""
echo -e "${GREEN}Emulaattori valmis!${NC}"

# Odota vielä hetki että emulaattori on täysin bootannut
echo -e "${YELLOW}Odotetaan käyttöjärjestelmän käynnistymistä...${NC}"
adb -s emulator-5554 wait-for-device
while [ "$(adb -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    printf "."
    sleep 2
done
echo ""
echo -e "${GREEN}Käyttöjärjestelmä valmis!${NC}"

echo -e "${GREEN}Käynnistetään Expo...${NC}"
echo ""

# Suorita expo-komento
eval "$EXPO_CMD"

# Pidä ikkuna auki jos komento päättyy
echo ""
echo -e "${YELLOW}Prosessi päättyi. Paina Enter sulkeaksesi ikkunan.${NC}"
read
