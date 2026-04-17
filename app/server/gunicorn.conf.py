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
loglevel = "warning"
accesslog = None
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

# Sentinel file used to elect exactly one worker as the scheduler worker.
# Uses /dev/shm (already our worker_tmp_dir) which is guaranteed writable.
# Written with O_EXCL so the first worker to create it wins atomically.
_SCHEDULER_SENTINEL = "/dev/shm/fireshare_scheduler.lock"


def on_starting(server):
    """Called just before the master process is initialized."""
    # Remove a stale sentinel from a previous run so the first worker of this
    # run can cleanly (re-)claim the scheduler role.
    try:
        os.unlink(_SCHEDULER_SENTINEL)
    except Exception:
        pass
    server.log.info("Starting Fireshare")


def post_fork(server, worker):
    """Elect exactly one worker to run the background scheduler.

    Each worker races to create the sentinel file with O_CREAT|O_EXCL, which
    is atomic on POSIX filesystems.  The winner sets FIRESHARE_START_SCHEDULER
    in its own environment; losers leave it unset.  create_app() reads this
    env var to decide whether to call init_schedule().

    Any failure here is logged and swallowed so hook errors never crash workers.
    """
    try:
        fd = os.open(_SCHEDULER_SENTINEL, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        os.environ['FIRESHARE_START_SCHEDULER'] = '1'
        server.log.info(f"Worker {os.getpid()}: elected as scheduler worker")
    except FileExistsError:
        # Another worker already claimed the scheduler role
        os.environ.pop('FIRESHARE_START_SCHEDULER', None)
    except Exception as e:
        # Sentinel creation failed (permissions, missing dir, etc.) — degrade
        # gracefully: no worker will run the scheduler rather than crashing.
        server.log.warning(f"Worker {os.getpid()}: could not create scheduler sentinel: {e}")
        os.environ.pop('FIRESHARE_START_SCHEDULER', None)


def worker_exit(server, worker):
    """When the scheduler worker exits, clear the sentinel so a replacement
    worker can take over the scheduler role on its next startup."""
    try:
        with open(_SCHEDULER_SENTINEL, 'r') as f:
            scheduler_pid = int(f.read().strip())
        if scheduler_pid == worker.pid:
            os.unlink(_SCHEDULER_SENTINEL)
            server.log.info(
                f"Scheduler worker {worker.pid} exited; sentinel cleared "
                "so a new worker can take over"
            )
    except Exception:
        pass


def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Fireshare is ready")


def on_reload(server):
    """Called to recycle workers during a reload."""
    server.log.info("Reloading Fireshare")
