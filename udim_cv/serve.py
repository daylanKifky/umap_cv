#!/usr/bin/env python3
"""
Simple static file server for serving the built site.
"""
import argparse
import http.server
import socketserver
import os
from pathlib import Path


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler that suppresses log messages"""
    
    def log_message(self, format, *args):
        """Override to suppress default logging"""
        pass


def serve(directory: str, host: str = 'localhost', port: int = 8000, quiet: bool = False):
    """
    Start a simple HTTP server to serve static files.
    
    Args:
        directory: Directory to serve files from
        host: Host to bind to (default: localhost)
        port: Port to bind to (default: 8000)
        quiet: Suppress request logs (default: False)
    """
    directory_path = Path(directory).resolve()
    
    if not directory_path.exists():
        print(f"❌ Error: Directory does not exist: {directory_path}")
        return
    
    if not directory_path.is_dir():
        print(f"❌ Error: Not a directory: {directory_path}")
        return
    
    # Change to the directory to serve
    os.chdir(directory_path)
    
    # Select handler class
    handler_class = QuietHTTPRequestHandler if quiet else http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer((host, port), handler_class) as httpd:
            server_url = f"http://{host}:{port}"
            print(f"🌐 Serving files from: {directory_path}")
            print(f"🚀 Server running at: {server_url}")
            print(f"📁 Directory: {directory_path}")
            print("\n💡 Press Ctrl+C to stop the server\n")
            
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Error: Port {port} is already in use")
            print(f"💡 Try a different port with --port {port + 1}")
        else:
            print(f"❌ Error: {e}")
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")


def _run():
    """Main entrypoint for command-line interface"""
    # Calculate default directory relative to this file
    udim_cv_dir = Path(__file__).parent
    project_root = udim_cv_dir.parent
    default_directory = str(project_root / 'public')
    
    parser = argparse.ArgumentParser(
        description='Start a simple HTTP server to serve static files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  # Serve from default directory (public/)
  python -m udim_cv.serve
  
  # Serve from custom directory
  python -m udim_cv.serve --directory build/public/
  
  # Serve on custom host and port
  python -m udim_cv.serve --host 0.0.0.0 --port 3000
  
  # Quiet mode (suppress request logs)
  python -m udim_cv.serve --quiet
        """
    )
    
    parser.add_argument(
        '--directory', '-d',
        type=str,
        default=default_directory,
        help=f'Directory to serve files from (default: {default_directory})'
    )
    
    parser.add_argument(
        '--host',
        type=str,
        default='localhost',
        help='Host to bind to (default: localhost)'
    )
    
    parser.add_argument(
        '--port', '-p',
        type=int,
        default=8000,
        help='Port to bind to (default: 8000)'
    )
    
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Suppress request logs'
    )
    
    args = parser.parse_args()
    
    serve(
        directory=args.directory,
        host=args.host,
        port=args.port,
        quiet=args.quiet
    )


if __name__ == '__main__':
    _run()

