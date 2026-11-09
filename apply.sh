#!/usr/bin/env bash
# apply.sh — أدوات النشر الموحّدة لمشروع PANDA-STORE
# الاستخدام: bash apply.sh <command>

PROJECT_DIR="/kaggle/working/PANDA-STORE"
CF_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-f0d94e89189b76b4fd64d463053a4ecf}"

cd "$PROJECT_DIR" || { echo "❌ مجلد المشروع غير موجود"; exit 1; }

# --- تحميل سرّ: من Kaggle Secrets أولاً، ثم من ملف ---
load_secret() {
  local name="$1"
  local file_path="$2"
  local val=""

  val=$(python3 -c "
from kaggle_secrets import UserSecretsClient
try:
    print(UserSecretsClient().get_secret('$name'))
except:
    pass
" 2>/dev/null) || true

  if [ -n "$val" ]; then
    echo "$val"
    return 0
  fi

  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    cat "$file_path"
    return 0
  fi

  return 1
}

case "${1:-help}" in
  status)
    echo "=== Git status ==="
    git status --short
    echo
    echo "=== آخر commit ==="
    git log --oneline -3
    echo
    echo "=== حجم المشروع ==="
    du -sh . 2>/dev/null | head -1
    ;;

  check)
    echo "=== tsc -b ==="
    pnpm exec tsc -b
    TSC_EXIT=$?
    echo "TSC_EXIT=$TSC_EXIT"
    exit $TSC_EXIT
    ;;

  build)
    echo "=== tsc + vite build ==="
    pnpm build
    BUILD_EXIT=$?
    echo "BUILD_EXIT=$BUILD_EXIT"
    exit $BUILD_EXIT
    ;;

  deploy)
    TOKEN=$(load_secret "CLOUDFLARE_API_TOKEN" ".cf_token")
    if [ -z "$TOKEN" ]; then
      echo "❌ CLOUDFLARE_API_TOKEN غير متاح"
      echo "الحل: أضفه إلى Kaggle Secrets (label: CLOUDFLARE_API_TOKEN)"
      echo "   أو أنشئ ملف .cf_token يحتوي التوكن"
      exit 1
    fi

    echo "=== بناء ==="
    pnpm build
    BUILD_EXIT=$?
    if [ $BUILD_EXIT -ne 0 ]; then
      echo "❌ البناء فشل — توقف"
      exit $BUILD_EXIT
    fi

    echo
    echo "=== نشر ==="
    rm -f dist/my_app/.dev.vars
    CLOUDFLARE_API_TOKEN="$TOKEN" CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" \
      npx wrangler deploy
    DEPLOY_EXIT=$?
    echo "DEPLOY_EXIT=$DEPLOY_EXIT"
    exit $DEPLOY_EXIT
    ;;

  push)
    MSG="${2:-update}"
    TOKEN=$(load_secret "GITHUB_TOKEN" ".git_token")
    if [ -z "$TOKEN" ]; then
      echo "❌ GITHUB_TOKEN غير متاح"
      echo "الحل: أضفه إلى Kaggle Secrets (label: GITHUB_TOKEN)"
      echo "   أو أنشئ ملف .git_token يحتوي التوكن"
      exit 1
    fi

    git add -A
    git -c user.email="boubakerboudinadev@gmail.com" -c user.name="Boubaker" \
      commit -m "$MSG" 2>&1 || echo "(لا تغييرات جديدة)"

    git push "https://boubaker100:${TOKEN}@github.com/boubaker100/PANDA-STORE.git" main
    PUSH_EXIT=$?
    echo "PUSH_EXIT=$PUSH_EXIT"
    exit $PUSH_EXIT
    ;;

  *)
    cat << 'HELP_EOF'
الاستخدام: bash apply.sh <command>

الأوامر:
  status             عرض حالة git والملفات
  check              فحص TypeScript فقط (سريع)
  build              بناء الإنتاج (tsc + vite)
  deploy             بناء + نشر على Cloudflare
  push "رسالة"       رفع التعديلات إلى GitHub

إعداد التوكنات (مرة واحدة):
  1) من Kaggle Secrets (الأفضل):
     File → Add-ons → Secrets
     - CLOUDFLARE_API_TOKEN
     - GITHUB_TOKEN

  2) أو ملفات محلية:
     echo "cfat_..." > .cf_token
     echo "ghp_..."  > .git_token

أمثلة:
  bash apply.sh status
  bash apply.sh check
  bash apply.sh deploy
  bash apply.sh push "fix: product page layout"
HELP_EOF
    ;;
esac
