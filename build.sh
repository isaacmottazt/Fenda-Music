#!/bin/bash
# Script de build — baixa a fonte offline automaticamente
# Execute uma vez no computador ou deixe o Vercel rodar via package.json

mkdir -p fonts

echo "Baixando Material Symbols Rounded..."

# Pega o CSS do Google Fonts e extrai a URL do woff2
CSS=$(curl -sA "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0")

WOFF2_URL=$(echo "$CSS" | grep -o 'https://fonts.gstatic.com[^)]*\.woff2' | head -1)

if [ -z "$WOFF2_URL" ]; then
  echo "ERRO: não conseguiu extrair URL do woff2"
  exit 1
fi

echo "URL encontrada: $WOFF2_URL"
curl -sA "Mozilla/5.0" "$WOFF2_URL" -o fonts/material-symbols-rounded.woff2

if [ -s fonts/material-symbols-rounded.woff2 ]; then
  echo "OK - fonte baixada: $(wc -c < fonts/material-symbols-rounded.woff2) bytes"
else
  echo "ERRO: arquivo vazio ou não baixado"
  exit 1
fi
