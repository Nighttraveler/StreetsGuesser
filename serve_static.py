"""Sirve solo los cinco activos públicos del juego, sin explorar directorios."""
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import signal


PUBLIC_TYPES = {
    "index.html": "text/html",
    "styles.css": "text/css",
    "game.mjs": "application/javascript",
    "app.mjs": "application/javascript",
    "arrecifes_calles.json": "application/json",
}


class StaticHandler(BaseHTTPRequestHandler):
    timeout = 5
    server_version = "Arrecifes"
    sys_version = ""

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self):
        # Un request nunca elige una ruta del sistema de archivos.
        assert isinstance(self.server, StaticServer)
        asset = self.server.assets.get(self.path.partition("?")[0])
        if asset is None:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        mime, body = asset
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command == "GET":
            self.wfile.write(body)

    do_HEAD = do_GET


class StaticServer(ThreadingHTTPServer):
    def __init__(self, address, static_dir):
        self.assets = {f"/{name}": (mime, (static_dir / name).read_bytes())
                       for name, mime in PUBLIC_TYPES.items()}
        self.assets["/"] = self.assets["/index.html"]
        super().__init__(address, StaticHandler)


def stop_server(_signal, _frame):
    # PID 1 necesita un manejador explícito para que Docker pueda pararlo.
    raise SystemExit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, stop_server)
    with StaticServer(("0.0.0.0", 8080), Path(__file__).resolve().parent / "public") as server:
        print("Arrecifes: escuchando en 8080/tcp", flush=True)
        server.serve_forever()
