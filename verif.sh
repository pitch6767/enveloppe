#!/bin/bash
# Barrière avant tout push : un test rouge doit arrêter la chaîne.
set -e
npx tsc --noEmit
npx vitest run
echo "VERIF OK"
