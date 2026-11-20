#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.1.2"]
# ///
import collections
import json
import math
import re
import unittest
import unicodedata
from decimal import Decimal
from shapely.geometry import LineString, box
from extract_gis import ROOT, LEVEL, boundary, build, key, rounded_coords


def fixture(i, name, highway, coords):
    return {'type': 'way', 'id': i, 'tags': {'name': name, 'highway': highway},
            'geometry': [{'lon': x, 'lat': y} for x, y in coords]}


class GIS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / 'arrecifes_source.json').read_text())
        cls.data = json.loads((ROOT / 'arrecifes_calles.json').read_text())
        cls.poly = boundary(cls.source)
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
        raw = json.loads((ROOT / 'arrecifes_calles.json').read_text(), parse_float=Decimal)
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
        areas = json.loads((ROOT / 'verify-area.json').read_text())['elements']
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


if __name__ == '__main__':
    unittest.main(verbosity=2)
