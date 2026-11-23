"""Acquisition tests: synthetic responses only, no external services."""
import dataclasses
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import download_gis as d

ROOT = Path(__file__).resolve().parent


def city(slug='ciudad-prueba', relation=123):
    return d.CityConfig(1, slug, 'Ciudad prueba', relation, (1, 2))


def response(relation=123):
    return {'osm3s': {'timestamp_osm_base': 'fixture'}, 'elements': [
        {'type': 'relation', 'id': relation, 'members': [{'type': 'way', 'ref': 9}]},
        {'type': 'way', 'id': 9, 'user': 'fixture editor', 'tags': {'name': 'A', 'highway': 'primary'},
         'geometry': [{'lon': 1, 'lat': 2}, {'lon': 2, 'lat': 3}]}]}


class DownloadTests(unittest.TestCase):
    def assert_code(self, code, fn):
        with self.assertRaises(d.DownloadError) as caught:
            fn()
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def test_two_cities_same_code_exact_requests_and_bytes(self):
        current = d.load_city_config(ROOT / 'data/arrecifes/city.json')
        for config in (current, city()):
            with self.subTest(city=config.slug):
                raw = (json.dumps(response(config.boundary_relation_id), indent=2) + '\n').encode()
                transport = Mock(return_value=raw)
                result = d.download_city(config, transport=transport)
                request = transport.call_args.args[0]
                transport.assert_called_once()
                self.assertEqual(request.query.count(f'rel({config.boundary_relation_id})'), 2)
                self.assertEqual(request.endpoint, d.DownloadOptions().endpoint)
                self.assertEqual(request.user_agent, d.DownloadOptions().user_agent)
                self.assertEqual((request.connect_timeout_seconds, request.total_timeout_seconds), (15, 150))
                self.assertEqual(result.city_slug, config.slug)
                self.assertEqual(result.raw_bytes, raw)
                self.assertEqual(result.source, response(config.boundary_relation_id))
                self.assertEqual(result.source_sha256, hashlib.sha256(raw).hexdigest())
        self.assertEqual(d.build_extract_query(current, d.DownloadOptions()).encode(),
                         (ROOT / 'data/arrecifes/extract.overpassql').read_bytes())

    def test_config_validation_before_transport(self):
        changes = [{'schema_version': True}, {'schema_version': 2}, {'slug': '../escape'},
                   {'name': ' '}, {'boundary_relation_id': True}, {'boundary_relation_id': 0},
                   {'reference_point_lonlat': (float('nan'), 2)}, {'reference_point_lonlat': (181, 2)},
                   {'reference_point_lonlat': (1, 91)}, {'reference_point_lonlat': (True, 2)},
                   {'reference_point_lonlat': (10**1000, 2)}]
        for change in changes:
            transport = Mock()
            self.assert_code('config', lambda: d.download_city(dataclasses.replace(city(), **change), transport=transport))
            transport.assert_not_called()

    def test_config_loader_rejects_shape_duplicate_keys_and_location(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'data' / 'ciudad-prueba' / 'city.json'
            path.parent.mkdir(parents=True)
            valid = dataclasses.asdict(city())
            for content in ('[]', '{', json.dumps({**valid, 'extra': 1}),
                            json.dumps({**valid, 'slug': 'other'}),
                            json.dumps(valid)[:-1] + ',"slug":"ciudad-prueba"}',
                            json.dumps({**valid, 'reference_point_lonlat': [float('inf'), 2]})):
                path.write_text(content)
                self.assert_code('config', lambda: d.load_city_config(path))

    def test_options_and_overrides(self):
        for change in ({'endpoint': 'http://example.com'}, {'endpoint': 'https://u:p@example.com'},
                       {'endpoint': 'https://example.com/#secret'}, {'endpoint': 'https://'},
                       {'endpoint': 'https://@example.com'},
                       {'user_agent': 'a\nb'}, {'total_timeout_seconds': 0},
                       {'connect_timeout_seconds': float('inf')}, {'query_timeout_seconds': True}):
            transport = Mock()
            self.assert_code('config', lambda: d.download_city(city(), options=d.DownloadOptions(**change), transport=transport))
            transport.assert_not_called()
        options = d.DownloadOptions(endpoint='https://example.org/interpreter', user_agent='Test/1',
                                    query_timeout_seconds=60, connect_timeout_seconds=5, total_timeout_seconds=80)
        transport = Mock(return_value=json.dumps(response()).encode())
        result = d.download_city(city(), options=options, transport=transport)
        self.assertIn('[timeout:60]', result.query)
        self.assertEqual(transport.call_args.args[0].endpoint, options.endpoint)

    def test_invalid_json_and_response(self):
        for raw in (b'<html>', b'\xff', b'{"value":NaN}', b'{"value":Infinity}', b'{"v":1e999}'):
            self.assert_code('invalid_json', lambda: d.download_city(city(), transport=lambda _: raw))
        bad = [[], {}, {**response(), 'elements': []}, {**response(), 'elements': [1]},
               {**response(), 'osm3s': []}, response(999),
               {**response(), 'elements': response()['elements'] * 2},
               {**response(), 'elements': [response()['elements'][0]]}]
        for data in bad:
            self.assert_code('invalid_response', lambda: d.download_city(city(), transport=lambda _: json.dumps(data).encode()))
        self.assert_code('overpass_remark', lambda: d.download_city(city(), transport=lambda _: json.dumps({**response(), 'remark': 'timeout'}).encode()))

    def test_typed_errors_single_attempt(self):
        for code in ('timeout', 'transport', 'http'):
            transport = Mock(side_effect=d.DownloadError(code, 'failure', http_status=429 if code == 'http' else None))
            error = self.assert_code(code, lambda: d.download_city(city(), transport=transport))
            self.assertEqual(error.city_slug, 'ciudad-prueba')
            transport.assert_called_once()

    def test_curl_arguments_status_and_errors(self):
        request = d.OverpassRequest('https://example.org/api', 'query\n', 'Test/1', 15, 150)
        def run(args, **kwargs):
            self.assertEqual(args[0:2], ['curl', '--disable'])
            self.assertIn('--fail', args)
            self.assertEqual(args[args.index('--data-urlencode') + 1], 'data@-')
            self.assertEqual(args[-1], request.endpoint)
            self.assertEqual(kwargs['input'], b'query\n')
            self.assertNotIn('--location', args)
            self.assertNotIn('--retry', args)
            self.assertNotIn('shell', kwargs)
            Path(args[args.index('--dump-header') + 1]).write_bytes(b'HTTP/2 200\r\n\r\n')
            return subprocess.CompletedProcess(args, 0, b'exact raw', b'')
        with patch.object(d.subprocess, 'run', side_effect=run):
            self.assertEqual(d.curl_transport(request), b'exact raw')
        for status in (406, 429, 500):
            def failed(args, **kwargs):
                Path(args[args.index('--dump-header') + 1]).write_bytes(f'HTTP/2 {status}\r\nRetry-After: 45\r\n\r\n'.encode())
                return subprocess.CompletedProcess(args, 22, b'partial', b'private remote payload')
            with patch.object(d.subprocess, 'run', side_effect=failed) as run_mock:
                error = self.assert_code('http', lambda: d.curl_transport(request))
                self.assertEqual(error.http_status, status)
                self.assertEqual(error.retry_after_seconds, 45)
                self.assertNotIn('private', str(error))
                if status in (406, 429):
                    self.assertIn('30', str(error))
                run_mock.assert_called_once()
        for exit_code, code in ((28, 'timeout'), (7, 'transport'), (22, 'http')):
            with patch.object(d.subprocess, 'run', return_value=subprocess.CompletedProcess([], exit_code, b'partial', b'')):
                self.assert_code(code, lambda: d.curl_transport(request))
        with patch.object(d.subprocess, 'run', side_effect=FileNotFoundError):
            self.assert_code('transport', lambda: d.curl_transport(request))

    def test_cli_success_no_overwrite_and_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'staging'
            current = d.load_city_config(ROOT / 'data/arrecifes/city.json')
            raw = json.dumps(response(current.boundary_relation_id)).encode()
            args = ['--city', 'arrecifes', '--output-dir', str(output)]
            with patch.object(d, 'curl_transport', return_value=raw), patch('sys.stdout', new_callable=io.StringIO):
                self.assertEqual(d.main(args), 0)
            self.assertEqual((output / 'source.json').read_bytes(), raw)
            self.assertEqual(json.loads((output / 'acquisition.json').read_text())['source_sha256'], hashlib.sha256(raw).hexdigest())
            with patch.object(d, 'curl_transport') as transport, patch('sys.stderr', new_callable=io.StringIO):
                self.assertEqual(d.main(args), 1)
                transport.assert_not_called()
            self.assertEqual((output / 'source.json').read_bytes(), raw)
            other = Path(tmp) / 'failure'
            with patch.object(d, 'curl_transport', return_value=raw), patch.object(Path, 'write_bytes', side_effect=OSError('disk full')), patch('sys.stderr', new_callable=io.StringIO) as stderr:
                self.assertEqual(d.main(['--city', 'arrecifes', '--output-dir', str(other)]), 1)
                self.assertIn('io:', stderr.getvalue())
            self.assertFalse(other.exists())

    def test_cli_errors_leave_canonical_and_public_unchanged(self):
        paths = list((ROOT / 'data/arrecifes').iterdir()) + [ROOT / 'arrecifes_calles.json']
        before = {p: p.read_bytes() for p in paths}
        with tempfile.TemporaryDirectory() as tmp:
            for code, status in [('http', 406), ('http', 429), ('http', 500), ('timeout', None), ('transport', None)]:
                output = Path(tmp) / 'staging'
                with patch.object(d, 'curl_transport', side_effect=d.DownloadError(code, 'failure', http_status=status)) as transport, patch('sys.stderr', new_callable=io.StringIO) as stderr:
                    self.assertEqual(d.main(['--city', 'arrecifes', '--output-dir', str(output)]), 1)
                    self.assertIn(code, stderr.getvalue())
                    transport.assert_called_once()
                self.assertFalse(output.exists())
        self.assertEqual(before, {p: p.read_bytes() for p in paths})
        with patch.object(d, 'curl_transport') as transport, patch('sys.stderr', new_callable=io.StringIO):
            self.assertEqual(d.main(['--city', '../x', '--output-dir', '/unused']), 1)
            self.assertEqual(d.main(['--city', 'arrecifes', '--output-dir', str(ROOT / 'data/arrecifes/new')]), 1)
            transport.assert_not_called()


    def test_real_cli_process_resolves_config_outside_cwd_and_reports_missing_curl(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'staging'
            # PATH empty ensures this execution cannot make an external request.
            process = subprocess.run([sys.executable, str(ROOT / 'download_gis.py'), '--city', 'arrecifes',
                                      '--output-dir', str(output)], cwd=tmp,
                                     env={**os.environ, 'PATH': ''}, capture_output=True)
            self.assertEqual(process.returncode, 1)
            self.assertIn(b'transport:', process.stderr)
            self.assertEqual(process.stdout, b'')
            self.assertFalse(output.exists())

    def test_existing_destination_race_does_not_delete_foreign_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'race'
            result = d.download_city(city(), transport=lambda _: json.dumps(response()).encode())
            output.mkdir()
            marker = output / 'foreign'
            marker.write_bytes(b'keep')
            self.assert_code('io', lambda: d.write_staging(result, output))
            self.assertEqual(marker.read_bytes(), b'keep')


if __name__ == '__main__':
    unittest.main(verbosity=2)
