#!/usr/bin/env python3
"""Avvia la dashboard Humfiverse in locale e apre il browser."""
import http.server
import socketserver
import webbrowser
import os

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)


class Server(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://127.0.0.1:{PORT}/index.html"
        print(f"Humfiverse in esecuzione su {url}")
        print("Premi Ctrl+C per fermare il server.")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer fermato.")


if __name__ == "__main__":
    main()
