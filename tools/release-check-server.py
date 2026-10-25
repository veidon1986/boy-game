#!/usr/bin/env python3
"""Isolated old-to-current PWA check. Binds loopback; never serves a real profile."""
import argparse
import io
import json
import mimetypes
import pathlib
import subprocess
import tarfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8787)
    parser.add_argument('--baseline', default='HEAD', help='Local Git ref to compare against')
    args = parser.parse_args()
    archive = subprocess.check_output(['git', 'archive', args.baseline], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(archive)) as source:
        baseline = {member.name: source.extractfile(member).read()
                    for member in source.getmembers() if member.isfile()}
    state = {'candidate': False, 'offline': False}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            path = urlsplit(self.path).path
            if path == '/fixture/candidate':
                state['candidate'] = True
            elif path == '/fixture/offline':
                state['offline'] = True
            else:
                self.send_error(404)
                return
            self.reply(b'OK', 'text/plain')

        def reply(self, data, content_type):
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = urlsplit(self.path).path
            if path in ('/', '/fixture/'):
                self.reply((ROOT / 'tests/browser-upgrade.html').read_bytes(), 'text/html; charset=utf-8')
                return
            if path == '/performance/':
                self.reply((ROOT / 'tests/browser-performance.html').read_bytes(), 'text/html; charset=utf-8')
                return
            if path == '/fixture/performance.js':
                self.reply((ROOT / 'tests/browser-performance.js').read_bytes(), 'text/javascript; charset=utf-8')
                return
            if path in ('/fixture/env.js', '/fixture/upgrade.js'):
                name = 'browser-upgrade-env.js' if path.endswith('/env.js') else 'browser-upgrade.js'
                self.reply((ROOT / 'tests' / name).read_bytes(), 'text/javascript; charset=utf-8')
                return
            if path == '/fixture/status':
                self.reply(json.dumps(state).encode(), 'application/json')
                return
            prefix = next((p for p in ('/app/', '/baseline/', '/candidate/') if path.startswith(p)), None)
            if not prefix:
                self.send_error(404)
                return
            if state['offline'] and prefix == '/app/':
                # Simulate a real network error, rather than an HTTP error response.
                self.close_connection = True
                return
            relative = path[len(prefix):] or 'index.html'
            if '..' in pathlib.PurePosixPath(relative).parts:
                self.send_error(400)
                return
            try:
                candidate = prefix == '/candidate/' or (prefix == '/app/' and state['candidate'])
                data = (ROOT / relative).read_bytes() if candidate else baseline[relative]
            except (KeyError, OSError):
                self.send_error(404)
                return
            if relative == 'index.html':
                # Before ANY application script: replace storage with the parent memory fixture.
                data = data.replace(b'<head>', b'<head><script src="/fixture/env.js"></script>', 1)
            if relative == 'js/main.js' and prefix != '/app/':
                # Compare cold HTTP app startup, excluding SW installation in BOTH releases.
                data = data.replace(b'    setupServiceWorker();', b'    /* SW installation excluded from cold HTTP benchmark. */')
            content_type = mimetypes.guess_type(relative)[0] or 'application/octet-stream'
            self.reply(data, content_type)

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print('Release check: http://127.0.0.1:%d/fixture/ (baseline %s)' % (args.port, args.baseline), flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
