#!/usr/bin/env bash
# =============================================================================
# FreeOS 容器入口脚本
#
# 环境变量:
#   HOME                      — 必须为 /data，使 ~/.octop 映射到数据卷
#   FREEOS_HOME               — 产品家目录（优先于 OCTOP_HOME）
#   OCTOP_HOME                — 遗留别名。未设置 FREEOS_HOME 时使用
#   OCTOP_DEFAULT_PASSWORD    — 首次管理员密码（须 ≥8 位且含字母和数字；
#                               不设置则自动生成随机密码，凭据写入
#                               /data/.octop/credential.txt）
#   OCTOP_ADMIN_USERNAME      — 首次管理员用户名（默认: admin）
#   OCTOP_ADMIN_DISPLAY_NAME  — 可选显示名
#   OCTOP_PORT                — 服务端口（默认: 8088）
#
# 密码兜底（修复 issue #502）：应用侧密码策略带常见弱密码黑名单（含
# Octop123），旧版默认密码会让 octop init 报 "password is too common"
# 退出、容器反复重启。现在：未设置密码时自动生成随机强密码；指定的
# 密码被策略拒绝时也自动改用随机密码重试，保证容器一定能完成首次初始化。
# =============================================================================
set -euo pipefail

export HOME="${HOME:-/data}"
# Honor an explicit product home. Otherwise follow PathLayout: an existing
# ~/.freeos, an existing ~/.octop, else a new ~/.freeos. Do not ignore
# FREEOS_HOME in favor of ${HOME}/.octop.
if [ -n "${FREEOS_HOME:-}" ]; then
    PRODUCT_HOME="$FREEOS_HOME"
elif [ -n "${OCTOP_HOME:-}" ]; then
    PRODUCT_HOME="$OCTOP_HOME"
elif [ -d "${HOME}/.freeos" ]; then
    PRODUCT_HOME="${HOME}/.freeos"
elif [ -d "${HOME}/.octop" ]; then
    PRODUCT_HOME="${HOME}/.octop"
else
    PRODUCT_HOME="${HOME}/.freeos"
fi
export FREEOS_HOME="$PRODUCT_HOME"
export OCTOP_HOME="$PRODUCT_HOME"
mkdir -p "$PRODUCT_HOME"
DB_FILE="${PRODUCT_HOME}/octop.db"
CREDENTIAL_FILE="${PRODUCT_HOME}/credential.txt"
ADMIN_USERNAME="${OCTOP_ADMIN_USERNAME:-admin}"
ADMIN_DISPLAY_NAME="${OCTOP_ADMIN_DISPLAY_NAME:-Admin}"
PORT="${OCTOP_PORT:-8088}"

# 生成随机密码（首字符字母、末字符数字，避开易混淆字符）。
octop_random_password() {
    local letters='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
    local digits='23456789'
    local all="${letters}${digits}" n=16 out="" i b
    b="$(od -An -N1 -tu1 /dev/urandom 2>/dev/null | tr -d '[:space:]')"
    out="${letters:$((b % ${#letters})):1}"
    for ((i = 1; i < n - 1; i++)); do
        b="$(od -An -N1 -tu1 /dev/urandom 2>/dev/null | tr -d '[:space:]')"
        out+="${all:$((b % ${#all})):1}"
    done
    b="$(od -An -N1 -tu1 /dev/urandom 2>/dev/null | tr -d '[:space:]')"
    out+="${digits:$((b % ${#digits})):1}"
    printf '%s' "$out"
}

DEFAULT_PASSWORD="${OCTOP_DEFAULT_PASSWORD:-}"

if [ ! -f "$DB_FILE" ]; then
    echo "[entrypoint] 首次启动，正在初始化 FreeOS..."

    if [ -z "$DEFAULT_PASSWORD" ]; then
        DEFAULT_PASSWORD="$(octop_random_password)"
        echo "[entrypoint] 未设置 OCTOP_DEFAULT_PASSWORD，已自动生成随机密码。"
    fi

    if ! octop init \
        --yes \
        --admin-username "$ADMIN_USERNAME" \
        --admin-password "$DEFAULT_PASSWORD" \
        ${ADMIN_DISPLAY_NAME:+--admin-display-name "$ADMIN_DISPLAY_NAME"}; then
        echo "[entrypoint] 指定的初始密码未通过应用密码策略（过弱或过于常见），改用随机密码重试 ..."
        DEFAULT_PASSWORD="$(octop_random_password)"
        octop init \
            --yes \
            --admin-username "$ADMIN_USERNAME" \
            --admin-password "$DEFAULT_PASSWORD" \
            ${ADMIN_DISPLAY_NAME:+--admin-display-name "$ADMIN_DISPLAY_NAME"}
    fi

    cat > "$CREDENTIAL_FILE" << EOF
FreeOS Login Credential
======================
URL:      http://<host>:${PORT}
Username: ${ADMIN_USERNAME}
Password: ${DEFAULT_PASSWORD}

Please change this password after first login!
  - Via Web: avatar menu → Change password
  - Via CLI: docker exec -it <container> octop user passwd --username $ADMIN_USERNAME

This file is rewritten whenever the initial password is (re)generated here.
If you changed the password inside the Web console, that password wins.
EOF
    chmod 600 "$CREDENTIAL_FILE"
    echo "[entrypoint] 凭据已保存至: $CREDENTIAL_FILE"
fi

if [ $# -eq 0 ]; then
    # Loopback unless OCTOP_BIND_HOST is set. Compose sets 0.0.0.0 inside the
    # container only together with a 127.0.0.1 published port. A bare docker
    # run stays on loopback. Host-network mode must not default to 0.0.0.0.
    BIND_HOST="${OCTOP_BIND_HOST:-127.0.0.1}"
    echo "[entrypoint] 正在启动 FreeOS，端口 $PORT，绑定 $BIND_HOST..."
    exec octop run --host "$BIND_HOST" --port "$PORT"
fi

if [ "$1" = "octop" ]; then
    echo "[entrypoint] 执行命令: $*"
    exec "$@"
fi

echo "[entrypoint] 执行命令: $*"
exec "$@"
