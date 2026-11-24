#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.1.2"]
# ///
"""Offline deterministic conversion; acquisition is isolated in download_gis.py."""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unicodedata
from download_gis import (DownloadError, DownloadOptions, load_city_config, parse_json,
                          validate_options, validate_slug, validate_source)
from shapely.geometry import LineString, Point, mapping
from shapely.errors import ShapelyError
from shapely.ops import polygonize_full, unary_union

ROOT = Path(__file__).resolve().parent
LEVEL = {'primary': 1, 'secondary': 1, 'trunk': 1, 'tertiary': 2, 'unclassified': 2, 'residential': 3}


def key(name):
    return ' '.join(unicodedata.normalize('NFC', name).casefold().split())


def boundary(source, *, relation_id, reference_point_lonlat):
    relation = next(e for e in source['elements'] if e['type'] == 'relation' and e['id'] == relation_id)
    lines = []
    for member in relation['members']:
        if member['type'] == 'node' and member['role'] == 'label':
            continue
        assert member['type'] == 'way' and member['role'] == 'outer', 'Unexpected boundary topology'
        lines.append(LineString([(p['lon'], p['lat']) for p in member['geometry']]))
    polygons, cuts, dangles, invalid = polygonize_full(lines)
    assert cuts.is_empty and dangles.is_empty and invalid.is_empty
    poly = unary_union(polygons)
    assert poly.geom_type == 'Polygon' and poly.is_valid and not poly.is_empty
    assert poly.contains(Point(*reference_point_lonlat))
    return poly


def line_parts(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == 'LineString':
        return [geometry]
    if hasattr(geometry, 'geoms'):
        return [part for g in geometry.geoms for part in line_parts(g)]
    return []  # point-only boundary contact is not a street segment


def rounded_coords(line):
    coords = []
    for x, y in line.coords:
        p = [round(x, 5), round(y, 5)]
        if not coords or p != coords[-1]:
            coords.append(p)
    return coords


def build(source, poly):
    assert not source.get('remark'), source.get('remark')
    groups = {}
    rejected = []
    ids = set()
    for way in sorted((e for e in source['elements'] if e['type'] == 'way'), key=lambda e: e['id']):
        assert way['id'] not in ids
        ids.add(way['id'])
        tags = way['tags']
        name, highway = tags.get('name', ''), tags.get('highway')
        reason = None
        if highway not in LEVEL:
            reason = 'highway_no_elegible'
        elif not key(name) or key(name) in {'calle s/n', 'sin nombre', 's/n'}:
            reason = 'nombre_ausente_o_marcador_sin_nombre'
        if reason:
            rejected.append({'osm_way_id': way['id'], 'nombre': name, 'highway': highway, 'motivo': reason})
            continue
        points = [(p['lon'], p['lat']) for p in way['geometry']]
        line = LineString(points)
        assert line.is_valid and line.length > 0
        segments = []
        for part in line_parts(line.intersection(poly)):
            coords = rounded_coords(part)
            if len(coords) < 2:
                continue
            rounded = LineString(coords)
            assert rounded.is_valid and rounded.length > 0
            segments.append({'osm_way_id': way['id'], 'highway': highway, 'coordenadas': coords})
        if not segments:
            rejected.append({'osm_way_id': way['id'], 'nombre': name, 'highway': highway, 'motivo': 'sin_linea_urbana_tras_recorte_redondeo'})
            continue
        group = groups.setdefault(key(name), {'names': set(), 'segments': []})
        group['names'].add(name)
        group['segments'].extend(segments)
    result = []
    for k, group in sorted(groups.items()):
        names = sorted(group['names'])
        segments = sorted(group['segments'], key=lambda s: (s['osm_way_id'], s['coordenadas']))
        classes = sorted({s['highway'] for s in segments})
        result.append({'nombre': names[0], 'nivel': min(LEVEL[c] for c in classes),
                       'nombres_originales': names, 'clases': classes,
                       'osm_way_ids': sorted({s['osm_way_id'] for s in segments}), 'segmentos': segments})
    return result, rejected


def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')


def provenance(directory, city, raw):
    sidecar = directory / 'acquisition.json'
    digest = hashlib.sha256(raw).hexdigest()
    if sidecar.exists():
        try:
            info = parse_json(sidecar.read_bytes())
            if (not isinstance(info, dict) or set(info) != {'endpoint', 'city_slug', 'source_sha256', 'query_file'}
                    or info['city_slug'] != city.slug or info['source_sha256'] != digest
                    or info['query_file'] != 'extract.overpassql'):
                raise ValueError('Acquisition mismatch')
            validate_options(DownloadOptions(endpoint=info['endpoint']))
            return info['endpoint']
        except (ValueError, TypeError) as error:
            raise DownloadError('config', 'Invalid acquisition provenance') from error
    # Explicit historical exception, not a fallback for unknown staging/cities.
    if (directory.resolve() == (ROOT / 'data/arrecifes').resolve() and city.slug == 'arrecifes'
            and digest == '9db4231faf45553abb7e251670e958a3b7ae5772a223ff57c5208cc98965de40'):
        return DownloadOptions().endpoint
    raise DownloadError('config', 'Unknown provenance: acquisition.json is required')


def encoded(data):
    return (json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def publish_prepared(outputs):
    """Prepare every byte on the target filesystem before replacing any output."""
    prepared = []
    try:
        for target, content in outputs.items():
            with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.gis-', delete=False) as handle:
                temporary = Path(handle.name)
                prepared.append((temporary, target))
                handle.write(content)
            os.chmod(temporary, 0o644)
        for temporary, target in prepared:
            temporary.replace(target)
    finally:
        for temporary, _ in prepared:
            temporary.unlink(missing_ok=True)


def transform_city(city, directory, *, public_path=None):
    directory = Path(directory).resolve()
    raw = (directory / 'source.json').read_bytes()
    source = validate_source(raw, city)
    endpoint = provenance(directory, city, raw)
    query = (directory / 'extract.overpassql').read_text(encoding='utf-8')
    if (f'rel({city.boundary_relation_id});' not in query or 'out meta geom;' not in query):
        raise DownloadError('config', 'Query does not identify the configured relation')
    poly = boundary(source, relation_id=city.boundary_relation_id,
                    reference_point_lonlat=city.reference_point_lonlat)
    result, rejected = build(source, poly)
    assert result and {e['nivel'] for e in result} == {1, 2, 3}
    streets = encoded(result)
    limit = encoded({'type': 'Feature', 'properties': {'osm_relation_id': city.boundary_relation_id}, 'geometry': mapping(poly)})
    metadata = {
        'schema_version': 1,
        'endpoint': endpoint,
        'query_file': 'extract.overpassql', 'fuente': source['osm3s'],
        'source_sha256': hashlib.sha256(raw).hexdigest(),
        'output_sha256': hashlib.sha256(streets).hexdigest(),
        'limite_relation_id': city.boundary_relation_id, 'bbox_wsen': list(poly.bounds),
        'conteo_entidades': len(result), 'conteo_por_nivel': dict(sorted(collections.Counter(e['nivel'] for e in result).items())),
        'vias_fuente': sum(e['type'] == 'way' for e in source['elements']),
        'vias_incluidas': len({i for e in result for i in e['osm_way_ids']}),
        'segmentos': sum(len(e['segmentos']) for e in result),
        'exclusiones': rejected,
        'atribucion': '© OpenStreetMap contributors', 'licencia': 'ODbL 1.0',
        'copyright_url': 'https://www.openstreetmap.org/copyright'
    }
    outputs = {directory / 'calles.json': streets, directory / 'limite.geojson': limit,
               directory / 'metadata.json': encoded(metadata)}
    if public_path is not None:
        if directory != (ROOT / 'data/arrecifes').resolve() or city.slug != 'arrecifes' or Path(public_path) != ROOT / 'frontend' / 'arrecifes_calles.json':
            raise DownloadError('config', 'Only canonical compatibility execution may publish')
        outputs[Path(public_path)] = streets
    publish_prepared(outputs)
    return metadata


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--city', default='arrecifes')  # compatibility wrapper only
    parser.add_argument('--input-dir', type=Path)
    args = parser.parse_args(argv)
    try:
        slug = validate_slug(args.city)
        canonical = ROOT / 'data' / slug
        city = load_city_config(canonical / 'city.json')
        directory = args.input_dir.resolve() if args.input_dir is not None else canonical
        if args.input_dir is not None:
            data_root = (ROOT / 'data').resolve()
            if directory.is_relative_to(data_root) or data_root.is_relative_to(directory):
                raise DownloadError('config', '--input-dir must be outside canonical data')
        public = ROOT / 'frontend' / 'arrecifes_calles.json' if args.input_dir is None and slug == 'arrecifes' else None
        metadata = transform_city(city, directory, public_path=public)
        print(json.dumps({k: v for k, v in metadata.items() if k != 'exclusiones'}, ensure_ascii=False, indent=2))
        return 0
    except (DownloadError, OSError, ValueError, TypeError, IndexError, AssertionError, KeyError, StopIteration, ShapelyError) as error:
        # Do not log source objects or remote remarks.
        code = error.code if isinstance(error, DownloadError) else 'io' if isinstance(error, OSError) else 'invalid_response'
        print(f'{code}: Offline transformation failed; no publication approved', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
