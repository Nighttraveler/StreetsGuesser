#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.1.2"]
# ///
"""Offline deterministic conversion; acquisition commands live in GIS_README.md."""
import collections
import hashlib
import json
from pathlib import Path
import unicodedata
from shapely.geometry import LineString, Point, mapping
from shapely.ops import polygonize_full, unary_union

ROOT = Path(__file__).resolve().parent
LEVEL = {'primary': 1, 'secondary': 1, 'trunk': 1, 'tertiary': 2, 'unclassified': 2, 'residential': 3}


def key(name):
    return ' '.join(unicodedata.normalize('NFC', name).casefold().split())


def boundary(source):
    relation = next(e for e in source['elements'] if e['type'] == 'relation' and e['id'] == 3743598)
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
    assert poly.contains(Point(-60.1087380, -34.0674983))
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


def main():
    source_path = ROOT / 'arrecifes_source.json'
    source = json.loads(source_path.read_text(encoding='utf-8'))
    poly = boundary(source)
    result, rejected = build(source, poly)
    assert result and {e['nivel'] for e in result} == {1, 2, 3}
    dump(ROOT / 'arrecifes_calles.json', result)
    dump(ROOT / 'arrecifes_limite.geojson', {'type': 'Feature', 'properties': {'osm_relation_id': 3743598}, 'geometry': mapping(poly)})
    metadata = {
        'schema_version': 1,
        'endpoint': 'https://overpass-api.de/api/interpreter',
        'query_file': 'extract.overpassql', 'fuente': source['osm3s'],
        'source_sha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
        'output_sha256': hashlib.sha256((ROOT / 'arrecifes_calles.json').read_bytes()).hexdigest(),
        'limite_relation_id': 3743598, 'bbox_wsen': list(poly.bounds),
        'conteo_entidades': len(result), 'conteo_por_nivel': dict(sorted(collections.Counter(e['nivel'] for e in result).items())),
        'vias_fuente': sum(e['type'] == 'way' for e in source['elements']),
        'vias_incluidas': len({i for e in result for i in e['osm_way_ids']}),
        'segmentos': sum(len(e['segmentos']) for e in result),
        'exclusiones': rejected,
        'atribucion': '© OpenStreetMap contributors', 'licencia': 'ODbL 1.0',
        'copyright_url': 'https://www.openstreetmap.org/copyright'
    }
    dump(ROOT / 'arrecifes_metadata.json', metadata)
    print(json.dumps({k: v for k, v in metadata.items() if k not in ('exclusiones',)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
