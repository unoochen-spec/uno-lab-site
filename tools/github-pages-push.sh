#!/usr/bin/env bash
# 用法：export GITHUB_TOKEN="ghp_你的Classic令牌"  （需勾选 repo）
#       bash tools/github-pages-push.sh
# 可选：GITHUB_REPO_NAME=uno-lab-site（默认） GITHUB_REPO_OWNER=组织名（默认当前用户）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
REPO_NAME="${GITHUB_REPO_NAME:-uno-lab-site}"

if [[ -z "$TOKEN" ]]; then
  echo "缺少 GITHUB_TOKEN。请到 https://github.com/settings/tokens 创建 Classic PAT（勾选 repo），然后执行：" >&2
  echo "  export GITHUB_TOKEN='ghp_……'" >&2
  echo "  bash tools/github-pages-push.sh" >&2
  exit 1
fi

hdr=(
  -H "Authorization: Bearer ${TOKEN}"
  -H "Accept: application/vnd.github+json"
  -H "X-GitHub-Api-Version: 2022-11-28"
)

LOGIN_JSON="$(curl -fsSL "${hdr[@]}" https://api.github.com/user)"
LOGIN="$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['login'])" <<<"$LOGIN_JSON")"
OWNER="${GITHUB_REPO_OWNER:-$LOGIN}"

echo "GitHub 用户/组织: $OWNER · 仓库: $REPO_NAME"

if ! curl -fsSL -o /dev/null "${hdr[@]}" "https://api.github.com/repos/${OWNER}/${REPO_NAME}"; then
  echo "创建仓库 ${OWNER}/${REPO_NAME} …"
  BODY="$(REPO_NAME="$REPO_NAME" python3 -c "import json,os; print(json.dumps({'name':os.environ['REPO_NAME'],'private':False,'auto_init':False}))")"
  if [[ "$OWNER" == "$LOGIN" ]]; then
    curl -fsSL -X POST "${hdr[@]}" https://api.github.com/user/repos -d "$BODY" >/dev/null
  else
    curl -fsSL -X POST "${hdr[@]}" "https://api.github.com/orgs/${OWNER}/repos" -d "$BODY" >/dev/null
  fi
else
  echo "仓库已存在，跳过创建。"
fi

echo "尝试启用 GitHub Pages（GitHub Actions / workflow）…"
HTTP="$(curl -sS -o /tmp/gh_pages_resp.json -w "%{http_code}" -X POST "${hdr[@]}" \
  "https://api.github.com/repos/${OWNER}/${REPO_NAME}/pages" \
  -d '{"build_type":"workflow","source":{"branch":"main","path":"/"}}' || true)"
if [[ "$HTTP" == "201" ]]; then
  echo "Pages 已配置为 workflow。"
elif [[ "$HTTP" == "409" ]]; then
  echo "Pages 已存在（409），视为已配置。"
else
  echo "Pages API 返回 HTTP $HTTP（首次可在网页：Settings → Pages → Source 选 GitHub Actions）。响应：" >&2
  cat /tmp/gh_pages_resp.json >&2 || true
fi

REMOTE="https://${OWNER}:${TOKEN}@github.com/${OWNER}/${REPO_NAME}.git"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${OWNER}/${REPO_NAME}.git"

echo "推送 main …"
git push "$REMOTE" main:main
git branch --set-upstream-to="origin/main" main 2>/dev/null || true

git remote set-url origin "https://github.com/${OWNER}/${REPO_NAME}.git"

echo ""
echo "完成。请在仓库 Actions 中查看部署；站点一般为："
echo "  https://${OWNER}.github.io/${REPO_NAME}/"
echo "若 Actions 未运行，请确认 Settings → Pages → Source 为「GitHub Actions」。"
