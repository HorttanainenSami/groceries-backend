#!/bin/bash
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
export PATH=$PATH:$ANDROID_HOME/platform-tools
echo -e '\033[0;32mPoistetaan vanha versio...\033[0m'
adb -s 1b64644b uninstall com.imasami.groceries 2>/dev/null || true
echo -e '\033[0;32mAsennetaan USB-laitteelle (1b64644b)...\033[0m'
adb -s 1b64644b install -r android/app/build/outputs/apk/debug/app-debug.apk
echo -e '\033[0;32mValmis! Avaa sovellus laitteella.\033[0m'
echo ''
echo -e '\033[0;33mPaina Enter sulkeaksesi.\033[0m'
read
