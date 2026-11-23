#!/usr/bin/env python3
"""Reusable Overpass acquisition. No GIS transformation or automatic publication."""
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


class DownloadError(Exception):
    def __init__(self, code, message, *, city_slug=None, http_status=None, retry_after_seconds=None):
        super().__init__(message)
        self.code = code
        self.city_slug = city_slug
        self.http_status = http_status
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class CityConfig:
    schema_version: int
    slug: str
    name: str
    boundary_relation_id: int
    reference_point_lonlat: tuple[float, float]


@dataclass(frozen=True)
class DownloadOptions:
    endpoint: str = 'https://overpass-api.de/api/interpreter'
    user_agent: str = 'ArrecifesStreetStudy/1.0 (one-off GIS extraction)'
    connect_timeout_seconds: int = 15
    total_timeout_seconds: int = 150
    query_timeout_seconds: int = 120


@dataclass(frozen=True)
class OverpassRequest:
    endpoint: str
    query: str
    user_agent: str
    connect_timeout_seconds: int
    total_timeout_seconds: int


@dataclass(frozen=True)
class DownloadResult:
    city_slug: str
    query: str
    endpoint: str
    raw_bytes: bytes
    source: dict
    source_sha256: str


def validate_slug(slug):
    if not isinstance(slug, str) or re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) is None:
        raise DownloadError('config', 'Invalid city slug')
    return slug


def validate_city(city):
    validate_slug(city.slug)
    if (type(city.schema_version) is not int or city.schema_version != 1
            or not isinstance(city.name, str) or not city.name.strip()
            or type(city.boundary_relation_id) is not int or city.boundary_relation_id <= 0):
        raise DownloadError('config', 'Invalid city identity')
    point = city.reference_point_lonlat
    if (not isinstance(point, (tuple, list)) or len(point) != 2
            or any(type(v) not in (int, float) or (type(v) is float and not math.isfinite(v)) for v in point)
            or not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90):
        raise DownloadError('config', 'Invalid longitude/latitude reference point')


def validate_options(options):
    try:
        endpoint = urlsplit(options.endpoint)
        valid = (endpoint.scheme == 'https' and endpoint.hostname and endpoint.username is None
                 and endpoint.password is None and not endpoint.fragment and endpoint.port != 0
                 and not any(c.isspace() or ord(c) < 32 for c in options.endpoint))
    except (ValueError, TypeError, AttributeError):
        valid = False
    if not valid:
        raise DownloadError('config', 'Endpoint must be HTTPS with host, without credentials or fragment')
    if (not isinstance(options.user_agent, str) or not options.user_agent.strip()
            or any(ord(c) < 32 or ord(c) == 127 for c in options.user_agent)):
        raise DownloadError('config', 'Invalid User-Agent')
    for value in (options.connect_timeout_seconds, options.total_timeout_seconds, options.query_timeout_seconds):
        if type(value) is not int or value <= 0:
            raise DownloadError('config', 'Timeouts must be positive integers')


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result


def _constant(value):
    raise ValueError('Nonfinite JSON number')


def _float(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError('Nonfinite JSON number')
    return result


def parse_json(raw):
    return json.loads(raw.decode('utf-8'), object_pairs_hook=_pairs, parse_constant=_constant, parse_float=_float)


def load_city_config(path: Path) -> CityConfig:
    path = Path(path).resolve()
    try:
        obj = parse_json(path.read_bytes())
        expected = {'schema_version', 'slug', 'name', 'boundary_relation_id', 'reference_point_lonlat'}
        if not isinstance(obj, dict) or set(obj) != expected or not isinstance(obj['reference_point_lonlat'], list):
            raise ValueError('Invalid city fields')
        city = CityConfig(**obj)
        validate_city(city)
        if path.name != 'city.json' or path.parent.name != city.slug or path.parent.parent.name != 'data':
            raise ValueError('Config must reside in data/<slug>/city.json')
        return city
    except (OSError, ValueError, TypeError) as error:
        raise DownloadError('config', 'Cannot load valid city configuration') from error


def build_extract_query(city: CityConfig, options: DownloadOptions) -> str:
    validate_city(city)
    validate_options(options)
    relation = city.boundary_relation_id
    return (f'[out:json][timeout:{options.query_timeout_seconds}];\n'
            f'rel({relation});out meta geom;\n'
            f'rel({relation});map_to_area->.urban;\n'
            'way["highway"]["name"](area.urban);\nout meta geom;\n')


def validate_source(raw, city):
    try:
        source = parse_json(raw)
    except (UnicodeError, ValueError, TypeError, AttributeError) as error:
        raise DownloadError('invalid_json', 'Response is not finite UTF-8 JSON', city_slug=city.slug) from error
    if not isinstance(source, dict):
        raise DownloadError('invalid_response', 'Expected Overpass object', city_slug=city.slug)
    if source.get('remark'):
        raise DownloadError('overpass_remark', 'Overpass reported a remark; no data published', city_slug=city.slug)
    elements = source.get('elements')
    if (not isinstance(source.get('osm3s'), dict) or not isinstance(elements, list)
            or not elements or not all(isinstance(e, dict) for e in elements)):
        raise DownloadError('invalid_response', 'Incomplete Overpass dataset', city_slug=city.slug)
    relations = [e for e in elements if e.get('type') == 'relation' and type(e.get('id')) is int
                 and e['id'] == city.boundary_relation_id]
    valid = (len(relations) == 1 and isinstance(relations[0].get('members'), list)
             and relations[0]['members'] and all(isinstance(m, dict) for m in relations[0]['members'])
             and any(e.get('type') == 'way' and isinstance(e.get('tags'), dict)
                     and isinstance(e.get('geometry'), list) and e['geometry'] for e in elements))
    if not valid:
        raise DownloadError('invalid_response', 'Incomplete or mismatched Overpass dataset', city_slug=city.slug)
    return source


def download_city(city: CityConfig, *, options: DownloadOptions | None = None, transport=None) -> DownloadResult:
    options = options if options is not None else DownloadOptions()
    query = build_extract_query(city, options)
    request = OverpassRequest(options.endpoint, query, options.user_agent,
                              options.connect_timeout_seconds, options.total_timeout_seconds)
    try:
        raw = (transport if transport is not None else curl_transport)(request)
    except DownloadError as error:
        error.city_slug = city.slug
        raise
    source = validate_source(raw, city)
    return DownloadResult(city.slug, query, options.endpoint, raw, source, hashlib.sha256(raw).hexdigest())


def _http_info(headers):
    status = None
    retry = None
    for line in headers.decode('iso-8859-1').splitlines():
        if line.startswith('HTTP/'):
            parts = line.split()
            status = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else None
            retry = None
        elif line.lower().startswith('retry-after:'):
            value = line.split(':', 1)[1].strip()
            if value.isascii() and value.isdigit():
                retry = int(value)
            else:
                try:
                    retry = max(0, math.ceil((parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()))
                except (ValueError, TypeError, OverflowError):
                    pass
    return status, retry


def curl_transport(request: OverpassRequest) -> bytes:
    # --disable must be first: local .curlrc must not enable redirects/retries/logs.
    try:
        with tempfile.TemporaryDirectory(prefix='overpass-') as tmp:
            headers = Path(tmp) / 'headers'
            process = subprocess.run([
                'curl', '--disable', '-sS', '--fail', '--connect-timeout', str(request.connect_timeout_seconds),
                '--max-time', str(request.total_timeout_seconds), '-A', request.user_agent,
                '--dump-header', str(headers), '--data-urlencode', 'data@-', request.endpoint,
            ], input=request.query.encode('utf-8'), capture_output=True, timeout=request.total_timeout_seconds + 5)
            status, retry = _http_info(headers.read_bytes() if headers.exists() else b'')
    except subprocess.TimeoutExpired as error:
        raise DownloadError('timeout', 'Acquisition deadline exceeded') from error
    except OSError as error:
        raise DownloadError('transport', 'Cannot execute curl transport') from error
    if process.returncode:
        code = {28: 'timeout', 22: 'http'}.get(process.returncode, 'transport')
        message = f'Acquisition failed ({code})'
        if status in (406, 429):
            message += '; wait at least 30 seconds and review current server policy'
        raise DownloadError(code, message, http_status=status, retry_after_seconds=retry)
    if status is not None and not 200 <= status < 300:
        raise DownloadError('http', 'Unexpected HTTP status; redirects are not followed', http_status=status, retry_after_seconds=retry)
    return process.stdout


def write_staging(result, destination):
    created = False
    try:
        destination.mkdir()  # exclusive: a racing/pre-existing directory is never ours to clean
        created = True
        (destination / 'source.json').write_bytes(result.raw_bytes)
        (destination / 'extract.overpassql').write_bytes(result.query.encode('utf-8'))
        (destination / 'acquisition.json').write_text(json.dumps({
            'endpoint': result.endpoint, 'city_slug': result.city_slug,
            'source_sha256': result.source_sha256, 'query_file': 'extract.overpassql',
        }, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    except OSError as error:
        if created:
            shutil.rmtree(destination)
        raise DownloadError('io', 'Cannot write new staging directory', city_slug=result.city_slug) from error


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--city', required=True)
    parser.add_argument('--output-dir', required=True, type=Path)
    defaults = DownloadOptions()
    for field in ('endpoint', 'user_agent', 'connect_timeout_seconds', 'total_timeout_seconds', 'query_timeout_seconds'):
        parser.add_argument('--' + field.replace('_', '-'), default=getattr(defaults, field),
                            type=int if field.endswith('_seconds') else str)
    args = parser.parse_args(argv)
    try:
        slug = validate_slug(args.city)
        city = load_city_config(ROOT / 'data' / slug / 'city.json')
        options = DownloadOptions(**{field: getattr(args, field) for field in DownloadOptions.__dataclass_fields__})
        validate_options(options)
        destination = args.output_dir.resolve()
        canonical = (ROOT / 'data').resolve()
        if (destination.exists() or args.output_dir.is_symlink() or destination.is_relative_to(canonical)
                or canonical.is_relative_to(destination)):
            raise DownloadError('io', 'Staging must be new and outside canonical data')
        result = download_city(city, options=options)
        write_staging(result, destination)
        print(f'{result.city_slug}: {destination} sha256={result.source_sha256}')
        return 0
    except DownloadError as error:
        print(f'{error.code}: {error}', file=sys.stderr)
        return 1
    except OSError:
        print('io: Cannot access staging path', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
