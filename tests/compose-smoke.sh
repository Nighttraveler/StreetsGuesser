#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

port=${1:-18090}
if [[ ! $port =~ ^[1-9][0-9]{3,4}$ ]] || (( port < 1024 || port > 65535 || port == 8090 )); then
  printf '%s\n' 'Elegir un puerto de prueba libre (1024–65535, distinto de 8090).' >&2
  exit 2
fi
listeners=$(ss -Hlt "sport = :$port")
[[ -z $listeners ]] || { printf '%s\n' "Puerto ocupado: $port" >&2; exit 1; }
umask 077
tmp=$(mktemp -d "${TMPDIR:-/tmp}/arrecifes-smoke.XXXXXXXX")
suffix=${tmp##*.}
project="arrecifes-smoke-${suffix,,}"
export HTTP_PORT=$port ARRECIFES_IMAGE="arrecifes-de-memoria:smoke-${suffix,,}"
export COMPOSE_SMOKE_ORIGIN="http://127.0.0.1:$port" COMPOSE_SMOKE_COOKIE_FILE="$tmp/session"
unset DOCKER_DEFAULT_PLATFORM
compose=(docker compose --env-file /dev/null -f "$PWD/compose.yaml")
app=("${compose[@]}" -p "$project")
restored=("${compose[@]}" -p "$project-restored")
started=0
restore_started=0

cleanup() {
  status=$?
  trap - EXIT
  if (( restore_started )); then
    "${restored[@]}" down --volumes || status=1
  fi
  if (( started )); then
    "${app[@]}" down --volumes --rmi local || status=1
    if docker image inspect "$ARRECIFES_IMAGE" >/dev/null 2>&1; then
      docker image rm "$ARRECIFES_IMAGE" || status=1
    fi
  fi
  rm -rf -- "$tmp"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for name in "$project" "$project-restored"; do
  [[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$name") ]]
  [[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$name") ]]
done
if docker image inspect "$ARRECIFES_IMAGE" >/dev/null 2>&1; then
  printf '%s\n' "Etiqueta de prueba ya existente: $ARRECIFES_IMAGE" >&2
  exit 1
fi

env -u HTTP_PORT -u ARRECIFES_IMAGE "${app[@]}" config --format json > "$tmp/default.json"
"${app[@]}" config --format json > "$tmp/smoke.json"
python3 - "$tmp" "$port" <<'PY'
import json
import os
from pathlib import Path
import sys

folder, smoke_port = sys.argv[1:]
for case, port, image in [
    ('default', '8090', 'arrecifes-de-memoria:local'),
    ('smoke', smoke_port, os.environ['ARRECIFES_IMAGE']),
]:
    model = json.loads((Path(folder) / f'{case}.json').read_text())
    assert list(model['services']) == ['web']
    assert list(model['volumes']) == ['rankings']
    assert not model.get('networks') and not model.get('secrets')
    web = model['services']['web']
    assert web['image'] == image and web['pull_policy'] == 'never' and 'platform' not in web
    assert web['network_mode'] == 'host'
    assert not any(web.get(key) for key in ('ports', 'networks', 'labels', 'privileged'))
    assert web['environment'] == {
        'RANKINGS_DB': '/var/lib/arrecifes/state/rankings.sqlite',
        'RANKINGS_DEVELOPMENT': '1',
        'RANKINGS_HOST': '127.0.0.1',
        'RANKINGS_PORT': port,
    }
    mount, = web['volumes']
    assert (mount['type'], mount['source'], mount['target']) == ('volume', 'rankings', '/var/lib/arrecifes')
    print(f'Compose {case}: 127.0.0.1:{port}, volumen privado, sin red externa')
PY

started=1
"${app[@]}" up -d --wait --wait-timeout 90
cid=$("${app[@]}" ps -q web)
original=$(docker inspect -f '{{.Image}}' "$cid")
docker image inspect -f 'Imagen {{.Id}} {{.Os}}/{{.Architecture}}' "$original"
[[ $(docker inspect -f '{{.State.Health.Status}} {{.HostConfig.NetworkMode}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Privileged}} {{.Config.User}}' "$cid") == 'healthy host true false node' ]]
[[ $(docker inspect -f '{{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}}' "$cid") == '["ALL"] ["no-new-privileges:true"]' ]]
[[ $(ss -Hlt "sport = :$port" | awk '{print $4}') == "127.0.0.1:$port" ]]
"${app[@]}" exec -T web sh -eu -c '
  test "$(id -u)" -ne 0
  test "$(stat -c "%a %u" /var/lib/arrecifes/state)" = "700 $(id -u)"
  test -s "$RANKINGS_DB"
  test -d "$RANKINGS_DB.datasets"
  node --version
'
node --test tests/compose.test.mjs

assert_saved() {
  node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = process.env.COMPOSE_SMOKE_ORIGIN;
const cookie = await readFile(process.env.COMPOSE_SMOKE_COOKIE_FILE, 'utf8');
const get = (path, headers) => fetch(origin + path, { headers, signal: AbortSignal.timeout(5000) });
const session = await get('/api/v1/session', { Cookie: cookie });
assert.equal(session.status, 200);
assert.equal((await session.json()).player.username, 'compose_jugador');
const ranking = await get('/api/v1/rankings?city_id=arrecifes&difficulty=1');
assert.equal(ranking.status, 200);
const { items } = await ranking.json();
assert.equal(items.length, 1);
assert.equal(items[0].username, 'compose_jugador');
assert.equal(items[0].score, 150);
JS
}

"${app[@]}" up -d --no-build --force-recreate --wait --wait-timeout 90
new_cid=$("${app[@]}" ps -q web)
[[ -n $new_cid && $new_cid != "$cid" && $(docker inspect -f '{{.Image}}' "$new_cid") == "$original" ]]
assert_saved
printf '%s\n' 'Recreación verificada: misma sesión y marca.'

"${app[@]}" exec -T web sh -eu -c '
  backup=$(mktemp -d)
  trap "rm -rf -- \"$backup\"" EXIT
  node --experimental-sqlite backend/ranked-game/backup.mjs "$RANKINGS_DB" "$backup/rankings.sqlite" >&2
  cp -R "$RANKINGS_DB.datasets" "$backup/rankings.sqlite.datasets"
  tar -C "$backup" -cf - rankings.sqlite rankings.sqlite.datasets
' > "$tmp/rankings.tar"
"${app[@]}" stop
restore_started=1
"${restored[@]}" run --rm -T --no-deps --entrypoint sh web -eu -c '
  state=${RANKINGS_DB%/*}
  test -z "$(ls -A "$state")"
  tar -C "$state" -xf -
' < "$tmp/rankings.tar"
"${restored[@]}" up -d --no-build --wait --wait-timeout 90
assert_saved
printf '%s\n' 'Restauración verificada en otro volumen: misma sesión y marca.'
