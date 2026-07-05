#!/usr/bin/env bash
# /api/analyze 手動測試腳本。
# 用法：./scripts/test-analyze.sh <站台網址> <商品圖路徑> [x-app-password]
# 例：  ./scripts/test-analyze.sh https://enxi-listing-tool.pages.dev ./spoon.jpg mypassword
set -euo pipefail

URL="${1:?用法: test-analyze.sh <站台網址> <商品圖路徑> [密碼]}"
IMG="${2:?請提供一張商品圖（jpg/png/webp）}"
PW="${3:-}"

# macOS 的 base64 用 -i，Linux 用 -w0；兩種都試。
B64=$(base64 -w0 "$IMG" 2>/dev/null || base64 -i "$IMG" | tr -d '\n')

MT="image/jpeg"
case "$IMG" in
  *.png) MT="image/png" ;;
  *.webp) MT="image/webp" ;;
esac

BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT
printf '{"product":{"name":"316不鏽鋼保溫杯","material":"不鏽鋼","colors":["黑色"],"size":"500ml"},"images":[{"media_type":"%s","data":"%s"}]}' \
  "$MT" "$B64" > "$BODY_FILE"

echo "POST $URL/api/analyze （圖：$IMG，$MT）" >&2

RESP=$(curl -sS -w '\n%{http_code}' -X POST "$URL/api/analyze" \
  -H 'content-type: application/json' \
  ${PW:+-H "x-app-password: $PW"} \
  --data @"$BODY_FILE")

STATUS=$(echo "$RESP" | tail -n1)
JSON=$(echo "$RESP" | sed '$d')

echo "HTTP $STATUS" >&2
if command -v jq >/dev/null 2>&1; then
  echo "$JSON" | jq .
else
  echo "$JSON"
fi

[ "$STATUS" = "200" ]
