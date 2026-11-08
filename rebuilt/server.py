from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
PORT = 8123
os.chdir(os.path.join(os.path.dirname(__file__), "public"))
class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
