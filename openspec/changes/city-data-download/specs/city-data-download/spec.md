## ADDED Requirements

### Requirement: Declarative city configuration
The module SHALL validate CityConfig from exactly schema_version=1, slug, name, boundary_relation_id and reference_point_lonlat, rejecting unknown/duplicate keys, booleans as numbers, unsafe slugs, nonfinite or out-of-range coordinates before network IO. Config SHALL reside at data/<slug>/city.json. Network policy SHALL be DownloadOptions, with HTTPS endpoint without credentials/fragment, positive timeouts and the historical defaults in CITY_DOWNLOAD_SPEC.md.

#### Scenario: Two compatible cities
- **WHEN** Arrecifes and a synthetic city with another relation/point are configured
- **THEN** the same functions build their respective relation queries without city-specific branches or changes to the module

#### Scenario: Invalid configuration
- **WHEN** configuration or options are invalid
- **THEN** DownloadError code config is raised before any request or output write

### Requirement: Reusable single-request acquisition
The library SHALL expose load_city_config, build_extract_query and download_city with CityConfig, DownloadOptions, OverpassRequest and DownloadResult as specified in CITY_DOWNLOAD_SPEC.md sections 4-5. Arrecifes default query SHALL match the baseline bytes. The injectable transport SHALL receive endpoint, query, user agent and timeouts once. Default curl SHALL POST form data from stdin without shell, redirects or retries. Successful results SHALL preserve raw bytes, source fields and their SHA-256 without GIS transformation.

#### Scenario: Valid response
- **WHEN** one valid response contains osm3s, the requested unique nonempty relation and at least one way with tags and geometry
- **THEN** the result contains the unchanged bytes, parsed source, query, endpoint, city slug and correct hash

### Requirement: Explicit failure without publication
DownloadError SHALL expose stable config, transport, timeout, http, invalid_json, invalid_response, overpass_remark and io codes and optional city/status/retry advice. Invalid UTF-8/JSON/nonfinite values, empty/malformed elements, wrong/duplicate relation and remarks SHALL fail. curl 28 SHALL map to timeout, 22 to http, other failures including missing curl to transport. Known HTTP status/Retry-After SHALL be retained, unknown status SHALL remain None. 406/429 SHALL advise waiting at least 30 seconds without sleeping/retrying. Partial output SHALL never be returned as success or published.

#### Scenario: HTTP or timeout failure
- **WHEN** HTTP 406/429/500, timeout, interrupted connection or missing curl occurs
- **THEN** a single attempt fails visibly and canonical snapshots and public data remain unchanged

### Requirement: Isolated staging CLI
The CLI SHALL require --city and --output-dir, resolve config relative to the module, validate before creating a new staging directory outside canonical data, and refuse existing destinations without changes. It SHALL write exact source/query and acquisition.json containing endpoint, city_slug, source_sha256 and query_file. Failures SHALL exit nonzero with concise stderr and clean only a directory created by that invocation. There SHALL be no --force or automatic promotion.

#### Scenario: Persistence failure
- **WHEN** staging exists or a write fails
- **THEN** foreign files are preserved, owned partial staging is removed and no canonical/public file is overwritten

### Requirement: Offline migration and compatibility
Canonical data SHALL reside in data/arrecifes/ with baseline raw/query/derived bytes unchanged. arrecifes_calles.json SHALL remain an identical regular public copy. The extractor SHALL parameterize boundary relation/point without changing GIS algorithms; default execution SHALL regenerate Arrecifes offline, optional --city/--input-dir SHALL transform staging without publication. Staging provenance SHALL validate slug/hash/query_file/endpoint; without sidecar only the known canonical historical snapshot SHALL be accepted. Derivatives SHALL be fully prepared before replacement, levels SHALL all be nonempty and metadata SHALL retain meaning. Only canonical Arrecifes SHALL update the public copy.

#### Scenario: Historical reproduction
- **WHEN** baseline Arrecifes is migrated and transformed offline
- **THEN** source, calles, límite and metadata match baseline hashes and the public game continues to use its unchanged URL and errors

#### Scenario: Private data
- **WHEN** clients request /data/arrecifes/source.json or /data/arrecifes/city.json
- **THEN** the static server returns 404 and the image/allowlist are not broadened

#### Scenario: Provenance mismatch
- **WHEN** a staging sidecar has the wrong slug/hash or is absent
- **THEN** transformation refuses publication without inferring provenance
