#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.1.2"]
# ///
import collections
import dataclasses
import hashlib
import io
import json
import math
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import unicodedata
from decimal import Decimal
from shapely.geometry import LineString, box
from download_gis import DownloadError, DownloadOptions, load_city_config, write_staging, download_city
from extract_gis import ROOT, LEVEL, boundary, build, key, rounded_coords, transform_city, publish_prepared, main

DATA = ROOT / 'data/arrecifes'


def fixture(i, name, highway, coords):
    return {'type': 'way', 'id': i, 'tags': {'name': name, 'highway': highway},
            'geometry': [{'lon': x, 'lat': y} for x, y in coords]}


class GIS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.city = load_city_config(DATA / 'city.json')
        cls.source = json.loads((DATA / 'source.json').read_text())
        cls.data = json.loads((DATA / 'calles.json').read_text())
        cls.poly = boundary(cls.source, relation_id=cls.city.boundary_relation_id,
                            reference_point_lonlat=cls.city.reference_point_lonlat)
        cls.ways = {e['id']: e for e in cls.source['elements'] if e['type'] == 'way'}

    def test_group_disconnected_and_mixed_classes(self):
        src = {'elements': [fixture(2, 'Calle Uno', 'residential', [(1, 1), (2, 2)]),
                            fixture(1, 'Calle Uno', 'secondary', [(6, 6), (7, 7)])]}
        data, excluded = build(src, box(0, 0, 10, 10))
        self.assertFalse(excluded)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['nivel'], 1)
        self.assertEqual(data[0]['osm_way_ids'], [1, 2])
        self.assertEqual(len(data[0]['segmentos']), 2)
        self.assertEqual(data[0]['nombres_originales'], ['Calle Uno'])

    def test_all_classes_and_exclusions(self):
        src = {'elements': [fixture(i, c, c, [(1, 1), (2, 2)]) for i, c in enumerate(list(LEVEL) + ['path', 'footway', 'motorway', 'service', 'primary_link'])]}
        data, excluded = build(src, box(0, 0, 10, 10))
        self.assertEqual({e['nombre']: e['nivel'] for e in data}, LEVEL)
        self.assertEqual(len(excluded), 5)

    def test_precision_and_collapsed_vertices(self):
        self.assertEqual(rounded_coords(LineString([(1.123456, 2.123456), (1.123457, 2.123457), (1.234567, 2.345678)])), [[1.12346, 2.12346], [1.23457, 2.34568]])
        raw = json.loads((DATA / 'calles.json').read_text(), parse_float=Decimal)
        for e in raw:
            for s in e['segmentos']:
                for point in s['coordenadas']:
                    for value in point:
                        self.assertEqual(value, round(value, 5))
                        if isinstance(value, Decimal):
                            self.assertGreaterEqual(value.as_tuple().exponent, -5)

    def test_clipping_and_split(self):
        poly = box(0, 0, 2, 2)
        src = {'elements': [fixture(1, 'A', 'residential', [(-1, 1), (3, 1), (3, 1.5), (-1, 1.5)])]}
        data, _ = build(src, poly)
        self.assertEqual(len(data[0]['segmentos']), 2)
        for s in data[0]['segmentos']:
            self.assertTrue(poly.covers(LineString(s['coordenadas'])))

    def test_missing_name_and_rounding_collapse(self):
        src = {'elements': [fixture(1, 'Calle S/N', 'residential', [(1, 1), (2, 2)]),
                            fixture(2, '', 'residential', [(1, 1), (2, 2)]),
                            fixture(3, 'Tiny', 'residential', [(1, 1), (1.000001, 1)])]}
        data, excluded = build(src, box(0, 0, 10, 10))
        self.assertEqual(data, [])
        self.assertEqual(len(excluded), 3)

    def test_uniqueness_and_order(self):
        keys = [key(e['nombre']) for e in self.data]
        self.assertEqual(keys, sorted(set(keys)))
        # Broader game-like equivalence catches accidental prefixed/accent variants.
        game_keys = []
        for e in self.data:
            k = ''.join(c for c in unicodedata.normalize('NFD', e['nombre'].lower()) if unicodedata.category(c) != 'Mn')
            k = re.sub(r'^(avenida|av\.?|calle|dr\.?|gral\.?)\s+', '', k)
            game_keys.append(k)
        self.assertEqual(len(game_keys), len(set(game_keys)))
        ids = [i for e in self.data for i in e['osm_way_ids']]
        self.assertEqual(len(ids), len(set(ids)))

    def test_real_geometry_and_traceability(self):
        for e in self.data:
            self.assertEqual(e['nivel'], min(LEVEL[c] for c in e['clases']))
            self.assertEqual(e['osm_way_ids'], sorted({s['osm_way_id'] for s in e['segmentos']}))
            self.assertEqual(e['segmentos'], sorted(e['segmentos'], key=lambda s: (s['osm_way_id'], s['coordenadas'])))
            for s in e['segmentos']:
                way = self.ways[s['osm_way_id']]
                self.assertIn(way['tags']['name'], e['nombres_originales'])
                self.assertEqual(way['tags']['highway'], s['highway'])
                line = LineString(s['coordenadas'])
                self.assertTrue(line.is_valid)
                self.assertGreater(line.length, 0)
                self.assertTrue(self.poly.buffer(0.000008).covers(line))
                original = LineString([(p['lon'], p['lat']) for p in way['geometry']])
                self.assertTrue(original.buffer(0.000008).covers(line))
                for x, y in s['coordenadas']:
                    self.assertTrue(math.isfinite(x) and math.isfinite(y))
                    self.assertTrue(-61 < x < -60 and -35 < y < -34)

    def test_no_exact_duplicate_geometries(self):
        seen = set()
        for e in self.data:
            for s in e['segmentos']:
                coords = tuple(map(tuple, s['coordenadas']))
                canonical = min(coords, coords[::-1])
                self.assertNotIn(canonical, seen)
                seen.add(canonical)

    def test_levels_and_source_accounting(self):
        self.assertEqual(set(e['nivel'] for e in self.data), {1, 2, 3})
        actual, excluded = build(self.source, self.poly)
        self.assertEqual(actual, self.data)
        used = {i for e in actual for i in e['osm_way_ids']}
        rejected = {e['osm_way_id'] for e in excluded}
        self.assertFalse(used & rejected)
        self.assertEqual(used | rejected, set(self.ways))

    def test_locality_not_partido(self):
        areas = json.loads((DATA / 'verify-area.json').read_text())['elements']
        area = {e['tags']['name']: e for e in areas}
        self.assertEqual(area['Arrecifes']['id'], 3603743598)
        self.assertEqual(area['Arrecifes']['tags']['admin_level'], '8')
        self.assertEqual(area['Partido de Arrecifes']['id'], 3602455558)
        self.assertEqual(area['Partido de Arrecifes']['tags']['admin_level'], '5')
        self.assertLess(self.poly.bounds[2] - self.poly.bounds[0], 0.1)
        self.assertLess(self.poly.bounds[3] - self.poly.bounds[1], 0.1)

    def test_examples(self):
        names = {e['nombre']: e for e in self.data}
        self.assertEqual(names['Avenida Belgrano']['nivel'], 1)
        self.assertEqual(names['Avenida Carlos Merlassino']['nivel'], 1)
        self.assertIn('tertiary', names['Avenida Carlos Merlassino']['clases'])
        self.assertEqual(names['Ricardo Gutiérrez']['nivel'], 3)
        self.assertNotIn('Avenida Merlassino', names)

    def test_migration_hashes_public_copy_and_offline_reproduction(self):
        hashes = {'source.json': '9db4231faf45553abb7e251670e958a3b7ae5772a223ff57c5208cc98965de40',
                  'calles.json': 'ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e',
                  'limite.geojson': '0cd2ef2ddd3a3eb3db7d7cc1b635bfa4daeefe16a1705059d8db960877b95f0e',
                  'metadata.json': '31bf7646d5259615df9e3ef1b175c19a738a7e6cc0a5901b474fba93f1412de7'}
        for name, digest in hashes.items():
            self.assertEqual(hashlib.sha256((DATA / name).read_bytes()).hexdigest(), digest)
        self.assertFalse((ROOT / 'arrecifes_calles.json').is_symlink())
        self.assertEqual((DATA / 'calles.json').read_bytes(), (ROOT / 'arrecifes_calles.json').read_bytes())
        with tempfile.TemporaryDirectory() as tmp:
            staging = Path(tmp) / 'staging'
            result = download_city(self.city, transport=lambda _: (DATA / 'source.json').read_bytes())
            write_staging(result, staging)
            with patch('sys.stdout', new_callable=io.StringIO):
                self.assertEqual(main(['--city', 'arrecifes', '--input-dir', str(staging)]), 0)
            for name in ('calles.json', 'limite.geojson', 'metadata.json'):
                self.assertEqual((staging / name).read_bytes(), (DATA / name).read_bytes())

    def test_provenance_errors_and_alternate_endpoint(self):
        with tempfile.TemporaryDirectory() as tmp:
            staging = Path(tmp) / 'staging'
            result = download_city(self.city, options=DownloadOptions(endpoint='https://example.org/api'),
                                   transport=lambda _: (DATA / 'source.json').read_bytes())
            write_staging(result, staging)
            metadata = transform_city(self.city, staging)
            self.assertEqual(metadata['endpoint'], 'https://example.org/api')
            before = {p: p.read_bytes() for p in staging.iterdir() if p.name != 'acquisition.json'}
            sidecar = staging / 'acquisition.json'
            original = json.loads(sidecar.read_text())
            for change in ({'city_slug': 'other'}, {'source_sha256': 'bad'}, {'endpoint': 'http://bad'},
                           {'query_file': '../extract.overpassql'}):
                sidecar.write_text(json.dumps({**original, **change}))
                with self.assertRaises(DownloadError):
                    transform_city(self.city, staging)
            sidecar.unlink()
            with self.assertRaises(DownloadError):
                transform_city(self.city, staging)
            self.assertEqual(before, {p: p.read_bytes() for p in staging.iterdir()})

    def test_second_city_transform_uses_its_relation_and_point(self):
        city = dataclasses.replace(self.city, slug='ciudad-prueba', name='Synthetic',
                                   boundary_relation_id=123, reference_point_lonlat=(1, 1))
        ring = [(0, 0), (2, 0), (2, 2), (0, 2), (0, 0)]
        source = {'osm3s': {'fixture': True}, 'elements': [
            {'type': 'relation', 'id': 123, 'members': [{'type': 'way', 'role': 'outer',
             'geometry': [{'lon': x, 'lat': y} for x, y in ring]}]},
            *[fixture(i, f'Calle {i}', highway, [(0.5, 0.5), (1.5, 1.5)])
              for i, highway in enumerate(('primary', 'tertiary', 'residential'))]]}
        with tempfile.TemporaryDirectory() as tmp:
            staging = Path(tmp) / 'staging'
            result = download_city(city, transport=lambda _: json.dumps(source).encode())
            write_staging(result, staging)
            metadata = transform_city(city, staging)
            self.assertEqual(metadata['limite_relation_id'], 123)
            self.assertEqual(metadata['conteo_por_nivel'], {1: 1, 2: 1, 3: 1})
            with self.assertRaises(AssertionError):
                boundary(source, relation_id=123, reference_point_lonlat=(10, 10))
            source['elements'][0]['members'][0]['role'] = 'inner'
            with self.assertRaises(AssertionError):
                boundary(source, relation_id=123, reference_point_lonlat=(1, 1))

    def test_failed_preparation_preserves_all_outputs_and_cleans_temporaries(self):
        import extract_gis
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            a, b = directory / 'a', directory / 'b'
            a.write_bytes(b'previous a')
            b.write_bytes(b'previous b')
            original = extract_gis.tempfile.NamedTemporaryFile
            calls = 0
            def fail_second(**kwargs):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError('disk full')
                return original(**kwargs)
            with patch.object(extract_gis.tempfile, 'NamedTemporaryFile', side_effect=fail_second):
                with self.assertRaises(OSError):
                    publish_prepared({a: b'new a', b: b'new b'})
            self.assertEqual(a.read_bytes(), b'previous a')
            self.assertEqual(b.read_bytes(), b'previous b')
            self.assertEqual(set(directory.iterdir()), {a, b})

    def test_invalid_transform_never_replaces_previous_derivatives(self):
        with tempfile.TemporaryDirectory() as tmp:
            staging = Path(tmp) / 'staging'
            source = json.loads((DATA / 'source.json').read_bytes())
            # Keep the real relation but only one road: two levels must be empty.
            source['elements'] = [e for e in source['elements'] if e['type'] == 'relation'] + [next(
                e for e in source['elements'] if e['type'] == 'way')]
            result = download_city(self.city, transport=lambda _: json.dumps(source).encode())
            write_staging(result, staging)
            for name in ('calles.json', 'limite.geojson', 'metadata.json'):
                (staging / name).write_bytes(b'previous')
            before = {p: p.read_bytes() for p in staging.iterdir()}
            with patch('sys.stderr', new_callable=io.StringIO) as stderr:
                self.assertEqual(main(['--input-dir', str(staging)]), 1)
                self.assertIn('invalid_response:', stderr.getvalue())
            self.assertEqual(before, {p: p.read_bytes() for p in staging.iterdir()})


if __name__ == '__main__':
    unittest.main(verbosity=2)
