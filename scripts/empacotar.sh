#!/usr/bin/env sh
# Cria dist/followtidy-<versão>.zip com o manifest na raiz (formato pedido pelas lojas).
set -e
cd "$(dirname "$0")/.."
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extensao/manifest.json)
mkdir -p dist
rm -f "dist/followtidy-$VERSION.zip"
(cd extensao && zip -qr "../dist/followtidy-$VERSION.zip" . -x '.*')
echo "dist/followtidy-$VERSION.zip"
