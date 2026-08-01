#!/usr/bin/env bash

set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$project_root/apps/backend"
backend_port="${FLY_BACKEND_PORT:-8080}"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -x /opt/homebrew/opt/openjdk@21/bin/java ]]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@21
  elif [[ -x /usr/local/opt/openjdk@21/bin/java ]]; then
    export JAVA_HOME=/usr/local/opt/openjdk@21
  elif [[ -x /usr/libexec/java_home ]]; then
    detected_java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [[ -n "$detected_java_home" ]]; then
      export JAVA_HOME="$detected_java_home"
    fi
  fi
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java 21 was not found. Install it with: brew install openjdk@21" >&2
  exit 1
fi

java_version="$($JAVA_HOME/bin/java -version 2>&1 | awk -F '"' '/version/ { print $2; exit }')"
java_major="${java_version%%.*}"
if [[ "$java_major" != "21" ]]; then
  echo "fly.ae requires Java 21, but JAVA_HOME points to Java $java_version." >&2
  echo "Unset JAVA_HOME and run this script again, or point it to Java 21." >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1 &&
  lsof -nP -iTCP:"$backend_port" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Port $backend_port is already in use. The backend may already be running." >&2
  echo "Check it with: curl http://localhost:$backend_port/actuator/health" >&2
  exit 1
fi

echo "Starting fly.ae backend on http://localhost:$backend_port"
echo "Java: $java_version"
echo "Stop the backend with Ctrl+C."

exec "$backend_dir/gradlew" -p "$backend_dir" clean bootRun "$@"
