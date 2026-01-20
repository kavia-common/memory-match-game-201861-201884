#!/bin/bash
cd /home/kavia/workspace/code-generation/memory-match-game-201861-201884/memory_game_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

