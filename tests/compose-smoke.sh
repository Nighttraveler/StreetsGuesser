#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

project=arrecifes-de-memoria-smoke
port=${1:-18090}
if [[ ! $port =~ ^[1-9][0-9]{0,4}$ ]] || (( port < 1024 || port > 65535 || port == 8090 )); then
  printf '%s\n' 'Elegir un puerto de prueba libre (1024–65535, distinto de 8090).' >&2
  exit 2
fi
[[ -f compose.yaml ]] || { printf '%s\n' 'Falta compose.yaml en el checkout del ensayo.' >&2; exit 1; }
export BIND_IP=127.0.0.1 HTTP_PORT=$port COMPOSE_SMOKE_ORIGIN="http://127.0.0.1:$port"
unset DOCKER_DEFAULT_PLATFORM

# No usar el .env local, una etiqueta compartida ni un proyecto ya existente.
tmp=$(mktemp -d "${TMPDIR:-/tmp}/arrecifes-smoke.XXXXXXXX")
suffix=${tmp##*.}
export ARRECIFES_IMAGE="arrecifes-de-memoria:smoke-${suffix,,}"
previous="${ARRECIFES_IMAGE}-previous"
compose=(docker compose -p "$project" --env-file /dev/null -f "$PWD/compose.yaml")
started=0
cleanup() {
  status=$?
  trap - EXIT
  if (( started )); then
    "${compose[@]}" down || status=1
    for tag in "$ARRECIFES_IMAGE" "$previous"; do
      if docker image inspect "$tag" >/dev/null 2>&1; then docker image rm "$tag" || status=1; fi
    done
  fi
  rm -rf -- "$tmp"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

containers=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
networks=$(docker network ls -q --filter "label=com.docker.compose.project=$project")
volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$project")
[[ -z $containers && -z $networks && -z $volumes ]] || { printf '%s\n' "Proyecto ya existente: $project" >&2; exit 1; }
for tag in "$ARRECIFES_IMAGE" "$previous"; do
  if docker image inspect "$tag" >/dev/null 2>&1; then
    printf '%s\n' "Etiqueta de prueba ya existente: $tag" >&2; exit 1
  fi
done
listeners=$(ss -Hlt "sport = :$port")
[[ -z $listeners ]] || { printf '%s\n' "Puerto ocupado: $port" >&2; exit 1; }

# Opción local para un daemon con pools agotados: no limpiar ni reutilizar redes ajenas.
if [[ -n ${SMOKE_SUBNET:-} ]]; then
  python3 - "$SMOKE_SUBNET" <<'PY'
from ipaddress import ip_network
import json
import subprocess
import sys

def output(*args):
    return subprocess.check_output(args, text=True)

subnet = ip_network(sys.argv[1])
if subnet.version != 4 or not any(subnet.subnet_of(ip_network(block)) for block in
        ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')) or not 24 <= subnet.prefixlen <= 29:
    sys.exit('SMOKE_SUBNET debe ser un bloque RFC1918, /24 a /29, sin bits de host')
ids = output('docker', 'network', 'ls', '-q').split()
networks = json.loads(output('docker', 'network', 'inspect', *ids))
routes = json.loads(output('ip', '-j', '-4', 'route', 'show', 'table', 'all'))
occupied = [cfg['Subnet'] for net in networks for cfg in (net['IPAM']['Config'] or []) if 'Subnet' in cfg]
occupied += [route['dst'] for route in routes if route['dst'] != 'default']
for entry in occupied:
    if subnet.overlaps(ip_network(entry, strict=False)):
        sys.exit(f'SMOKE_SUBNET {subnet} se solapa con {entry}')
print(f'Red bridge aislada: {subnet} sin solapamiento en Docker ni rutas IPv4 del host')
PY
  printf 'networks:\n  default:\n    ipam:\n      config:\n        - subnet: "%s"\n' "$SMOKE_SUBNET" > "$tmp/network.yaml"
  compose+=(-f "$tmp/network.yaml")
fi

# Verificar modelo renderizado sin abrir puertos de producción.
env -u BIND_IP -u HTTP_PORT -u ARRECIFES_IMAGE "${compose[@]}" config --format json > "$tmp/default.json"
BIND_IP=192.168.0.105 HTTP_PORT=8090 "${compose[@]}" config --format json > "$tmp/lan.json"
"${compose[@]}" config --format json > "$tmp/smoke.json"
python3 - "$tmp" "$PWD" "$port" <<'PY'
import json
import os
from pathlib import Path
import sys

folder, context, port = sys.argv[1:]
for case, bind, published in [('default', '127.0.0.1', '8090'), ('lan', '192.168.0.105', '8090'), ('smoke', '127.0.0.1', port)]:
    model = json.loads((Path(folder) / f'{case}.json').read_text())
    assert list(model['services']) == ['web'] and not model.get('volumes') and not model.get('secrets')
    web = model['services']['web']
    assert web['build']['context'] == context and 'platform' not in web
    assert web['image'] == ('arrecifes-de-memoria:local' if case == 'default' else os.environ['ARRECIFES_IMAGE'])
    assert web['pull_policy'] == 'never' and web['restart'] == 'unless-stopped'
    assert not any(web.get(key) for key in ('volumes', 'environment', 'privileged', 'container_name', 'depends_on', 'network_mode'))
    (binding,) = web['ports']
    assert (binding['host_ip'], binding['published'], binding['target'], binding['protocol']) == (bind, published, 8080, 'tcp')
    (network,) = model['networks'].values()
    assert network['driver'] == 'bridge' and not network.get('external')
    print(f'config {case}: {bind}:{published} -> 8080/tcp')
PY

started=1
printf 'Proyecto %s, origen %s, imagen %s\n' "$project" "$COMPOSE_SMOKE_ORIGIN" "$ARRECIFES_IMAGE"
"${compose[@]}" up -d --wait --wait-timeout 90
cid=$("${compose[@]}" ps -q web)
original=$(docker inspect -f '{{.Image}}' "$cid")
docker image inspect -f 'Imagen {{.Id}} {{.Os}}/{{.Architecture}}' "$original"
[[ $(docker inspect -f '{{.State.Health.Status}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Privileged}} {{.Config.User}} {{len .Mounts}}' "$cid") == 'healthy true false arrecifes 0' ]]
[[ $("${compose[@]}" port web 8080) == "127.0.0.1:$port" ]]
[[ $(docker inspect -f '{{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}}' "$cid") == '["ALL"] ["no-new-privileges:true"]' ]]
[[ $(docker inspect -f '{{.HostConfig.LogConfig.Type}} {{index .HostConfig.LogConfig.Config "max-size"}} {{index .HostConfig.LogConfig.Config "max-file"}}' "$cid") == 'json-file 10m 3' ]]
"${compose[@]}" exec -T web sh -eu -c '
  test "$(id -un)" = arrecifes; test "$(id -u)" -ne 0
  if command -v nginx; then exit 1; fi
  case "$(readlink /proc/1/exe)" in /usr/local/bin/python3.*) ;; *) exit 1;; esac
  while read -r name real effective rest; do
    case "$name" in Uid:) test "$effective" -ne 0; uid=$effective;;
      CapEff:) test "$real" = 0000000000000000;;
      NoNewPrivs:) test "$real" = 1;; esac
  done < /proc/1/status
  printf "Python PID 1 UID efectivo: %s\n" "$uid"
  test "$(stat -c %a /tmp)" = 1777
  df -k /tmp | awk "NR == 2 { if (\$2 != 16384) exit 1; found = 1 } END { if (!found) exit 1 }"
  touch /tmp/compose-smoke-write
  awk '\''$2 == "/" { n = split($4, opts, ","); for (i = 1; i <= n; ++i) if (opts[i] == "ro") found = 1 } END { exit !found }'\'' /proc/mounts
  test "$(ls -A /srv/arrecifes/public)" = "app.mjs
arrecifes_calles.json
game.mjs
index.html
styles.css"
  wget -q -O /dev/null http://127.0.0.1:8080/
'
printf '%s\n' 'Healthy, UID no-root, sin capacidades, rootfs RO, tmpfs 16 MiB y exactamente cinco archivos.'
node --test tests/compose.test.mjs

assert_dataset() {
  curl --noproxy '*' -fsS --max-time 5 "$COMPOSE_SMOKE_ORIGIN/arrecifes_calles.json" -o "$tmp/dataset.json"
  cmp arrecifes_calles.json "$tmp/dataset.json"
}
wait_healthy() {
  local id=$1 attempt
  for ((attempt=0; attempt<45; attempt++)); do
    [[ $(docker inspect -f '{{.State.Health.Status}}' "$id") == healthy ]] && return 0
    sleep 2
  done
  return 1
}
"${compose[@]}" stop
[[ $(docker inspect -f '{{.State.Status}}' "$cid") == exited ]]
if curl --noproxy '*' -sS --max-time 2 "$COMPOSE_SMOKE_ORIGIN/" -o /dev/null; then
  printf '%s\n' 'El puerto aún responde con web parado.' >&2; exit 1
fi
"${compose[@]}" start
[[ $("${compose[@]}" ps -q web) == "$cid" ]]
wait_healthy "$cid"
assert_dataset

# El daemon reinicia la aplicación ante la salida del proceso, no por un stop manual.
restart_count=$(docker inspect -f '{{.RestartCount}}' "$cid")
"${compose[@]}" exec -T web sh -ec 'kill -TERM 1'
for ((attempt=0; attempt<15; attempt++)); do
  (( $(docker inspect -f '{{.RestartCount}}' "$cid") > restart_count )) && break
  sleep 2
done
(( $(docker inspect -f '{{.RestartCount}}' "$cid") > restart_count ))
wait_healthy "$cid"
assert_dataset
printf '%s\n' 'Recuperación automática: mismo contenedor y dataset, RestartCount incrementado.'

"${compose[@]}" up -d --no-build --force-recreate --wait --wait-timeout 90
new_cid=$("${compose[@]}" ps -q web)
[[ -n $new_cid && $new_cid != "$cid" && $(docker inspect -f '{{.Image}}' "$new_cid") == "$original" ]]
assert_dataset
"${compose[@]}" logs --tail=5 web
printf '%s\n' 'Stop/start y recreación: mismo dataset, IDs comprobados, logs accesibles.'

# Imagen previa exportada; la versión siguiente cambia solo un label de build.
docker image tag "$original" "$previous"
docker image save -o "$tmp/previous.tar" "$previous"
cp -- compose.yaml "$tmp/previous.compose.yaml"
printf 'BIND_IP=127.0.0.1\nHTTP_PORT=%s\nARRECIFES_IMAGE=%s\n' "$port" "$previous" > "$tmp/previous.env"
archived=(previous.tar previous.compose.yaml previous.env)
rollback=(docker compose -p "$project" --env-file "$tmp/previous.env" -f "$tmp/previous.compose.yaml")
if [[ -f $tmp/network.yaml ]]; then
  archived+=(network.yaml)
  rollback+=(-f "$tmp/network.yaml")
fi
(cd "$tmp"; sha256sum "${archived[@]}" > previous.sha256; sha256sum -c previous.sha256)
docker image rm "$previous"
printf 'services:\n  web:\n    build:\n      labels:\n        io.arrecifes.smoke.next: "%s"\n' "$suffix" > "$tmp/next.yaml"
"${compose[@]}" -f "$tmp/next.yaml" up -d --build --wait --wait-timeout 90
next=$(docker inspect -f '{{.Image}}' "$("${compose[@]}" ps -q web)")
[[ $next != "$original" ]]
assert_dataset
docker image load -i "$tmp/previous.tar"
env -u BIND_IP -u HTTP_PORT -u ARRECIFES_IMAGE "${rollback[@]}" up -d --no-build --wait --wait-timeout 90
restored=$(docker inspect -f '{{.Image}}' "$("${compose[@]}" ps -q web)")
[[ $restored == "$original" ]]
assert_dataset
printf 'Rollback offline sin rebuild: %s -> %s\n' "$next" "$restored"
