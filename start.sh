#!/bin/bash

# ============================================
# Presentation Bot — Avtomatik ishga tushirish
# ============================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Loyiha ishga tushirilmoqda..."
echo "📁 Papka: $PROJECT_DIR"

# Eski jarayonlarni to'xtatish
echo "🛑 Eski jarayonlar to'xtatilmoqda..."
pkill -f "node index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "node bot.js" 2>/dev/null
pkill -f "localhost.run" 2>/dev/null
sleep 1

# 1) Frontend ishga tushirish
echo "🎨 Frontend ishga tushirilmoqda (port 5173)..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 3
echo "✅ Frontend PID: $FRONTEND_PID"

# 2) Tunnel ochish va URL ni avtomatik .env ga yozish
echo "🌐 Tunnel ochilmoqda..."
cd "$PROJECT_DIR"

TUNNEL_URL=""
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R 80:localhost:5173 nokey@localhost.run 2>&1 | while IFS= read -r line; do
    echo "$line"
    if echo "$line" | grep -q "lhr.life"; then
        URL=$(echo "$line" | grep -oP 'https://[^\s]+\.lhr\.life')
        if [ -n "$URL" ] && [ "$URL" != "$TUNNEL_URL" ]; then
            TUNNEL_URL="$URL"
            echo ""
            echo "🔗 Yangi URL topildi: $TUNNEL_URL"
            
            # .env faylini yangilash (lokal)
            sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=$TUNNEL_URL|g" "$PROJECT_DIR/.env"
            echo "✅ .env yangilandi: WEBAPP_URL=$TUNNEL_URL"
            
            # 3) Backend ishga tushirish (yangi URL tayyor bo'lgach)
            echo "⚙️  Backend va Bot ishga tushirilmoqda (port 5000)..."
            pkill -f "node index.js" 2>/dev/null
            sleep 1
            cd "$PROJECT_DIR/backend"
            node index.js &
            BACKEND_PID=$!
            
            echo ""
            echo "============================================"
            echo "🤖 BOT VA BACKEND TAYYOR!"
            echo "🔗 Web App URL: $TUNNEL_URL"
            echo "============================================"
        fi
    fi
done
