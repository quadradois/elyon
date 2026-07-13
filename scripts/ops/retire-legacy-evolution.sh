#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-apply}"
[[ "$mode" == "apply" || "$mode" == "--check" ]] || {
  echo "Uso: $0 [apply|--check]" >&2
  exit 2
}

backup_root="${EVOLUTION_LEGACY_BACKUP_DIR:-/var/backups/elyon/evolution-legacy}"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
dump_path="${backup_root}/evolution-api-${timestamp}.dump"
evidence_path="${backup_root}/evolution-api-${timestamp}.evidence"
legacy_containers=(evolution_api postgres_evolution redis_evolution)

for container in "${legacy_containers[@]}"; do
  docker inspect "$container" >/dev/null 2>&1 || {
    echo "Container legado ausente: ${container}" >&2
    exit 2
  }
done

active_count=$(docker exec postgres_evolution psql -U evolution -d evolution -Atc \
  'SELECT count(*) FROM "Instance" WHERE "connectionStatus" = '\''open'\'';')
[[ "$active_count" == "0" ]] || {
  echo "Abortado: existem ${active_count} instancias abertas no stack legado." >&2
  exit 3
}

legacy_names=$(mktemp)
elyon_names=$(mktemp)
overlap=$(mktemp)
trap 'rm -f "$legacy_names" "$elyon_names" "$overlap"' EXIT

docker exec postgres_evolution psql -U evolution -d evolution -Atc \
  'SELECT name FROM "Instance" ORDER BY name;' > "$legacy_names"
docker exec elyon_postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc '\''SELECT "instanceName" FROM sessoes_whatsapp ORDER BY "instanceName";'\''' \
  > "$elyon_names"
comm -12 "$legacy_names" "$elyon_names" > "$overlap"

if [[ -s "$overlap" ]]; then
  echo "Abortado: ha sessoes do banco ELYON com o mesmo nome no stack legado." >&2
  exit 4
fi

if [[ "$mode" == "--check" ]]; then
  echo "CHECK_OK active_legacy_instances=0 elyon_session_name_overlap=0"
  echo "Nenhum container, dado ou volume foi alterado."
  exit 0
fi

install -d -m 700 "$backup_root"
umask 077
docker exec postgres_evolution pg_dump -U evolution -d evolution --format=custom > "$dump_path"
[[ -s "$dump_path" ]] || { echo "Backup vazio; retirada abortada." >&2; exit 5; }
docker exec -i postgres_evolution pg_restore --list < "$dump_path" >/dev/null
checksum=$(sha256sum "$dump_path" | awk '{print $1}')
printf '%s  %s\n' "$checksum" "$(basename "$dump_path")" > "${dump_path}.sha256"

docker stop evolution_api postgres_evolution redis_evolution >/dev/null
docker rm evolution_api postgres_evolution redis_evolution >/dev/null

cat > "$evidence_path" <<EOF
retired_at_utc=${timestamp}
database_dump=${dump_path}
sha256=${checksum}
active_legacy_instances=${active_count}
elyon_session_name_overlap=0
removed_containers=evolution_api,postgres_evolution,redis_evolution
retained_volumes=evolution_evolution_postgres_data,evolution_evolution_redis_data
EOF
chmod 600 "$evidence_path" "${dump_path}.sha256"

for url in https://api.elyon.ia.br/health https://crm.elyon.ia.br https://elyon.ia.br; do
  curl --fail --silent --show-error --max-time 10 "$url" >/dev/null
done

echo "Retirada concluida; backup verificado em ${dump_path}"
echo "Checksum SHA-256 registrado em ${dump_path}.sha256"
echo "Volumes legados preservados para retencao e rollback."
