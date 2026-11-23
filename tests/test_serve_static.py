"""Pruebas HTTP del lanzador, contra un puerto efímero de loopback."""
from http.client import HTTPConnection
from pathlib import Path
from threading import Thread
import unittest

from serve_static import StaticServer


ROOT = Path(__file__).resolve().parents[1]


class StaticServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # El checkout contiene archivos privados: deben seguir siendo inaccesibles.
        cls.server = StaticServer(("127.0.0.1", 0), ROOT)
        cls.thread = Thread(target=cls.server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)
        cls.server.server_close()

    def request(self, method, path):
        client = HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            client.request(method, path)
            response = client.getresponse()
            return response.status, response.headers, response.read()
        finally:
            client.close()

    def test_get_index_and_five_files_with_explicit_headers(self):
        for path, file, mime in (
                ("/", "index.html", "text/html"),
                ("/index.html", "index.html", "text/html"),
                ("/styles.css", "styles.css", "text/css"),
                ("/app.mjs", "app.mjs", "application/javascript"),
                ("/game.mjs", "game.mjs", "application/javascript"),
                ("/arrecifes_calles.json?v=1", "arrecifes_calles.json", "application/json")):
            with self.subTest(path=path):
                status, headers, body = self.request("GET", path)
                self.assertEqual(status, 200)
                self.assertEqual(headers["Content-Type"], mime)
                self.assertEqual(headers["Cache-Control"], "no-cache")
                self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
                self.assertEqual(body, (ROOT / file).read_bytes())
                self.assertEqual(headers["Content-Length"], str(len(body)))

    def test_head_has_get_headers_and_no_body(self):
        _, get_headers, _ = self.request("GET", "/game.mjs")
        status, head_headers, body = self.request("HEAD", "/game.mjs")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")
        for header in ("Content-Type", "Content-Length", "Cache-Control"):
            self.assertEqual(head_headers[header], get_headers[header])

    def test_private_or_unknown_paths_never_read_from_checkout(self):
        for path in ("/package.json", "/serve_static.py", "/tests/", "/.env", "/missing",
                     "/data/arrecifes/source.json", "/data/arrecifes/city.json"):
            with self.subTest(path=path):
                status, _, body = self.request("GET", path)
                self.assertEqual(status, 404)
                self.assertNotIn(b"Directory listing", body)

    def test_unsupported_method_does_not_serve_asset(self):
        status, _, body = self.request("POST", "/app.mjs")
        self.assertEqual(status, 501)
        self.assertNotEqual(body, (ROOT / "app.mjs").read_bytes())
