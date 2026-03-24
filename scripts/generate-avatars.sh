#!/bin/bash
# Generate test avatars for seed users using DiceBear API
# Saves PNG-like SVG files to public/avatars/
# DiceBear "adventurer" style — friendly illustrated faces

AVATAR_DIR="$(dirname "$0")/../public/avatars"
mkdir -p "$AVATAR_DIR"

# User names matching seed.sql
declare -A USERS
USERS[1]="Paul Newman"
USERS[2]="Jane Rivers"
USERS[3]="Tom Taylor"
USERS[4]="Kate Davis"
USERS[5]="Andrew Stone"
USERS[6]="Lucy Martin"
USERS[7]="Martin Blake"
USERS[8]="Eva Brooks"
USERS[9]="Jake Black"
USERS[10]="Tessa Wells"

echo "Generating avatars..."

for id in "${!USERS[@]}"; do
  name="${USERS[$id]}"
  # URL-encode the name (replace spaces with %20)
  encoded=$(echo "$name" | sed 's/ /%20/g')
  file="$AVATAR_DIR/seed_user_${id}.svg"

  # DiceBear adventurer style — generates unique friendly faces from seed
  url="https://api.dicebear.com/9.x/adventurer/svg?seed=${encoded}&size=200&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf"

  echo "  [$id] $name -> seed_user_${id}.svg"
  curl -s -o "$file" "$url"
done

echo ""
echo "Done! Generated ${#USERS[@]} avatars in $AVATAR_DIR"
echo "Now run seed.sql to set avatar paths in the database."
