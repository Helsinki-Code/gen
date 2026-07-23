#!/bin/sh
# Minimal HTTP health server (daemon) + procrastinate worker process
# Cloud Run requires an HTTP response on $PORT — this thread satisfies that
python -c "
import os, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
t = threading.Thread(target=lambda: HTTPServer(('', int(os.environ.get('PORT', 8080))), H).serve_forever(), daemon=True)
t.start()
import time; time.sleep(999999)
" &
exec "$@"
