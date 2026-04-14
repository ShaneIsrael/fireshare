import multiprocessing
import os

# Server socket
bind = "127.0.0.1:5000"
backlog = 2048  # Number of pending connections

# Worker processes
workers = multiprocessing. cpu_count() * 2 + 1  # Recommended formula
worker_class = "gthread"  # Use threaded workers
threads = 8  # 8 threads per worker (I/O-bound workload benefits from more threads)
worker_connections = 1000
max_requests = 2000  # Restart workers after N requests (prevents memory leaks)
max_requests_jitter = 100  # Add randomness to prevent all workers restarting at once

# Timeouts
timeout = 120  # Worker timeout (normal requests)
graceful_timeout = 30
keepalive = 5  # Keep connections alive

# Logging
loglevel = "info"
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "fireshare"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None  # Set by command line
group = None  # Set by command line
tmp_upload_dir = None

# Preload app (be careful with SQLite - might need to disable)
preload_app = False  # Changed from True - SQLite doesn't like forking

# Worker tmp directory
worker_tmp_dir = "/dev/shm"  # Use RAM for worker tmp files

def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting Fireshare")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Fireshare is ready")

def on_reload(server):
    """Called to recycle workers during a reload."""
    server.log.info("Reloading Fireshare")
