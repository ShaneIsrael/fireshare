import os, sys, re, copy, tempfile
import os.path
try:
    import ldap
except ImportError:
    ldap = None
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS
from pathlib import Path
import logging
import json
import secrets
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool
from sqlite3 import Connection as SQLite3Connection

logger = logging.getLogger('fireshare')
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(os.getenv('FS_LOGLEVEL', 'INFO').upper())
formatter = logging.Formatter('%(asctime)s %(levelname)-7s %(module)s.%(funcName)s:%(lineno)d | %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

# Configure SQLite for better concurrency
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    if isinstance(dbapi_conn, SQLite3Connection):
        cursor = dbapi_conn.cursor()
        
        # Enable WAL mode for better concurrency
        cursor.execute("PRAGMA journal_mode=WAL")
        
        # Set busy timeout to 30 seconds (instead of failing immediately)
        cursor.execute("PRAGMA busy_timeout = 30000")

        # Raise WAL autocheckpoint threshold to reduce write-latency spikes
        # (default is 1000 pages ~4MB; 10000 pages ~40MB smooths out periodic flushes)
        cursor.execute("PRAGMA wal_autocheckpoint = 10000")
        
        # Increase cache size (default is 2MB, increase to 64MB)
        cursor.execute("PRAGMA cache_size = -64000")
        
        # Synchronous = NORMAL for better performance (still safe with WAL)
        cursor.execute("PRAGMA synchronous = NORMAL")
        
        # Temp store in memory
        cursor.execute("PRAGMA temp_store = MEMORY")
        
        # Increase mmap size for better read performance
        cursor.execute("PRAGMA mmap_size = 268435456")  # 256MB
        
        cursor.close()
        
# init SQLAlchemy so we can use it later in our models
db = SQLAlchemy()
migrate = Migrate()

def update_config(path):
    logger.debug("Validating configuration file...")
    def combine(dict1, dict2):
        for key in dict2:
            if key in dict1:
                if isinstance(dict1[key], list): # If value is a list, we want special logic
                    if isinstance(dict2[key], list): # if the "input" is a list, just do list + list
                        dict1[key] = dict1[key] + dict2[key]
                    else:
                        dict1[key].append(dict2[key])
                elif isinstance(dict1[key], dict): # calling itself recursively
                    if key in dict2 and isinstance(dict2[key], dict):
                        dict1[key] = combine(dict1[key], dict2[key])
                    else:
                        pass #keep default dict as is




                else: # Overwrites all other values
                    dict1[key] = dict2[key]
            else: # Creates the values that doesn't exist.
                dict1[key] = dict2[key]
        return dict1

    def atomic_write(target, content):
        dir = target.parent
        with tempfile.NamedTemporaryFile('w', dir=dir, delete=False, suffix='.tmp') as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        os.replace(tmp_path, target)

    from .constants import DEFAULT_CONFIG
    if not path.exists():
        atomic_write(path, json.dumps(DEFAULT_CONFIG, indent=2))

    with open(path, 'r') as configfile:
        try:
            current = json.load(configfile)
        except:
            backup = path.with_suffix('.json.bak')
            logger.warning(f"Invalid config.json at {str(path)}, backing up to {str(backup)} and resetting to defaults")
            path.rename(backup)
            atomic_write(path, json.dumps(DEFAULT_CONFIG, indent=2))
            current = copy.deepcopy(DEFAULT_CONFIG)
        # If image_defaults is missing, inherit from video_defaults so privacy stays consistent
        if 'image_defaults' not in current.get('app_config', {}):
            video_private = current.get('app_config', {}).get('video_defaults', {}).get('private', True)
            current.setdefault('app_config', {})['image_defaults'] = {'private': video_private}
        updated = combine(copy.deepcopy(DEFAULT_CONFIG), current)
        atomic_write(path, json.dumps(updated, indent=2))

def create_app(init_schedule=False):
    app = Flask(__name__, static_url_path='', static_folder='build', template_folder='build')
    CORS(app, supports_credentials=True)
    if 'DATA_DIRECTORY' not in os.environ:
        raise Exception("DATA_DIRECTORY not found in environment")

    app.config['ENVIRONMENT'] = os.getenv('ENVIRONMENT')
    app.config['DOMAIN'] = os.getenv('DOMAIN')
    app.config['THUMBNAIL_VIDEO_LOCATION'] = int(os.getenv('THUMBNAIL_VIDEO_LOCATION') or 0)

    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))

    from datetime import timedelta
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

    app.config['DATA_DIRECTORY'] = os.getenv('DATA_DIRECTORY')
    app.config['VIDEO_DIRECTORY'] = os.getenv('VIDEO_DIRECTORY')
    app.config['PROCESSED_DIRECTORY'] = os.getenv('PROCESSED_DIRECTORY')
    app.config['IMAGE_DIRECTORY'] = os.getenv('IMAGE_DIRECTORY')
    app.config['ADMIN_USERNAME'] = os.getenv('ADMIN_USERNAME')
    app.config['ADMIN_PASSWORD'] = os.getenv('ADMIN_PASSWORD')
    app.config['DISABLE_ADMINCREATE'] = bool(os.getenv("DISABLE_ADMINCREATE"))
    app.config['LDAP_ENABLE'] = bool(os.getenv("LDAP_ENABLE"))
    app.config['LDAP_URL'] = os.getenv("LDAP_URL")
    app.config['LDAP_STARTLS'] = bool(os.getenv("LDAP_STARTLS"))
    app.config['LDAP_BASEDN'] = os.getenv("LDAP_BASEDN")
    app.config['LDAP_BINDDN'] = os.getenv("LDAP_BINDDN")
    app.config['LDAP_PASSWORD'] = os.getenv("LDAP_PASSWORD")
    app.config['LDAP_USER_FILTER'] = os.getenv("LDAP_USER_FILTER")
    app.config['LDAP_ADMIN_GROUP'] = os.getenv("LDAP_ADMIN_GROUP")
    app.config['DEMO_MODE'] = os.getenv('DEMO_MODE', '').lower() in ('true', '1', 'yes')
    app.config['DEMO_UPLOAD_LIMIT_MB'] = int(os.getenv('DEMO_UPLOAD_LIMIT_MB', '0') or '0')
    app.config['ENABLE_TRANSCODING'] = (
        False if app.config['DEMO_MODE']
        else os.getenv('ENABLE_TRANSCODING', '').lower() in ('true', '1', 'yes')
    )
    app.config['TRANSCODE_GPU'] = (
        False if os.getenv('FIRESHARE_LITE', '').lower() in ('true', '1', 'yes')
        else os.getenv('TRANSCODE_GPU', '').lower() in ('true', '1', 'yes')
    )
    app.config['SERVE_GAME_ASSETS_NGINX'] = os.getenv('ENVIRONMENT', '') == 'production'
    app.config['TRANSCODE_TIMEOUT'] = int(os.getenv('TRANSCODE_TIMEOUT', '7200'))  # Default: 2 hours

    #Integrations
    app.config['DISCORD_WEBHOOK_URL'] = os.getenv('DISCORD_WEBHOOK_URL', '')
    app.config['GENERIC_WEBHOOK_URL'] = os.getenv('GENERIC_WEBHOOK_URL', '')
    raw_payload = os.getenv('GENERIC_WEBHOOK_PAYLOAD')
    if raw_payload:
        try:
            app.config['GENERIC_WEBHOOK_PAYLOAD'] = json.loads(raw_payload)
        except (json.JSONDecodeError, TypeError) as e:
            app.logger.error(f"FATAL: GENERIC_WEBHOOK_PAYLOAD contains invalid JSON syntax, please verify JSON format")
            sys.exit(1) 
    else:
        app.config['GENERIC_WEBHOOK_PAYLOAD'] = None

    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{app.config["DATA_DIRECTORY"]}/db.sqlite'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    # Configure SQLite connection for thread safety with Flask's --with-threads
    # NullPool creates a fresh connection per request, avoiding thread conflicts
    # WAL mode (set in pragma) handles concurrent reads/writes efficiently
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'poolclass': NullPool,
        'connect_args': {
            'check_same_thread': False,
        },
    }
    app.config['SCHEDULED_JOBS_DATABASE_URI'] = f'sqlite:///{app.config["DATA_DIRECTORY"]}/jobs.sqlite'
    app.config['INIT_SCHEDULE'] = init_schedule
    app.config['MINUTES_BETWEEN_VIDEO_SCANS'] = int(os.getenv('MINUTES_BETWEEN_VIDEO_SCANS', '5'))
    app.config['WARNINGS'] = []

    if (app.config['ADMIN_PASSWORD'] and app.config['ADMIN_USERNAME'] == "admin") and app.config["DISABLE_ADMINCREATE"] == False:
        stdPasswordWarning = "You are using the Default Login-Credentials, please consider changing it."
        app.config['WARNINGS'].append(stdPasswordWarning)
        logger.warning(stdPasswordWarning)

    # Check for SteamGridDB API key
    config_path = Path(app.config['DATA_DIRECTORY']) / 'config.json'
    steamgrid_api_key = os.environ.get('STEAMGRIDDB_API_KEY', '')
    if config_path.exists():
        with open(config_path, 'r') as configfile:
            try:
                config_data = json.load(configfile)
                config_steamgrid_key = config_data.get('integrations', {}).get('steamgriddb_api_key', '')
                if config_steamgrid_key:
                    steamgrid_api_key = config_steamgrid_key
            except:
                pass

    if not steamgrid_api_key:
        steamgridWarning = "SteamGridDB API key not configured. Game metadata features are unavailable. Click here to set it up."
        app.config['WARNINGS'].append(steamgridWarning)
        logger.warning(steamgridWarning)

    paths = {
        'data': Path(app.config['DATA_DIRECTORY']),
        'video': Path(app.config['VIDEO_DIRECTORY']),
        'processed': Path(app.config['PROCESSED_DIRECTORY']),
    }
    if app.config['IMAGE_DIRECTORY']:
        paths['images'] = Path(app.config['IMAGE_DIRECTORY'])
    app.config['PATHS'] = paths
    failed_paths = []
    for k, path in paths.items():
        if not path.is_dir():
            if k != 'images':
                logger.info(f"Creating {k} directory at {str(path)}")
            try:
                path.mkdir(parents=True, exist_ok=True)
            except PermissionError:
                if k != 'images':
                    logger.warning(f"Permission denied creating {k} directory at {str(path)}. Mount a volume to this path or ensure the directory exists with correct permissions.")
                failed_paths.append(k)
    for k in failed_paths:
        del paths[k]
    app.config['PATHS'] = paths
    subpaths = [
        paths['processed'] / 'video_links',
        paths['processed'] / 'image_links',
        paths['processed'] / 'derived',
    ]
    for subpath in subpaths:
        if not subpath.is_dir():
            logger.info(f"Creating subpath directory at {str(subpath.absolute())}")
            subpath.mkdir(parents=True, exist_ok=True)

    # Clean up any leftover chunk files from interrupted uploads, but only once
    # per gunicorn master lifetime.  With preload_app=False, create_app() runs in
    # every worker process, including workers that restart while an upload is in
    # progress.  We use a sentinel file (same O_CREAT|O_EXCL pattern as the
    # scheduler election) so only the very first worker to start does the cleanup;
    # all subsequent workers - including restarts triggered by max_requests or
    # crashes - skip it and leave in-progress chunks untouched.
    import tempfile as _tempfile
    _SHM_DIR = "/dev/shm" if os.path.isdir("/dev/shm") else _tempfile.gettempdir()
    _CLEANUP_SENTINEL = os.path.join(_SHM_DIR, "fireshare_cleanup.lock")
    _should_cleanup = False
    try:
        fd = os.open(_CLEANUP_SENTINEL, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        _should_cleanup = True
    except FileExistsError:
        pass  # Another worker already claimed cleanup for this startup
    except Exception as e:
        logger.warning(f"Could not create cleanup sentinel: {e}")

    if _should_cleanup:
        import glob as _glob
        chunk_files = _glob.glob(str(paths['video'] / '**' / '*.part[0-9][0-9][0-9][0-9]'), recursive=True)
        for chunk_file in chunk_files:
            try:
                os.remove(chunk_file)
                logger.info(f"Removed leftover upload chunk: {chunk_file}")
            except OSError as e:
                logger.warning(f"Failed to remove leftover upload chunk {chunk_file}: {e}")

    # Ensure game_assets directory exists
    game_assets_dir = paths['data'] / 'game_assets'
    if not game_assets_dir.is_dir():
        logger.info(f"Creating game_assets directory at {str(game_assets_dir.absolute())}")
        game_assets_dir.mkdir(parents=True, exist_ok=True)
    
    update_config(paths['data'] / 'config.json')

    if app.config['DEMO_MODE']:
        _demo_config_path = paths['data'] / 'config.json'
        with open(_demo_config_path, 'r+') as _f:
            _cfg = json.load(_f)
            _cfg.setdefault('app_config', {})['allow_public_upload'] = True
            _cfg.setdefault('app_config', {})['allow_public_folder_selection'] = True
            _cfg.setdefault('app_config', {})['allow_public_game_tag'] = True
            _f.seek(0)
            json.dump(_cfg, _f, indent=2)
            _f.truncate()

    db.init_app(app)
    migrate.init_app(app, db)

    # Reset any transcode jobs that were marked 'running' when the container
    # last shut down — those processes are gone, so the jobs need to be retried.
    # Also purge completed/failed rows from the previous session so their counts
    # don't bleed into the next session's progress display.
    try:
        from .models import TranscodeJob
        from .api.transcoding import _ensure_drain_running
        with app.app_context():
            purged = TranscodeJob.query.filter(
                TranscodeJob.status.in_(['complete', 'failed'])
            ).delete()
            if purged:
                logger.info(f"Purged {purged} completed/failed transcode job(s) from previous session")

            stale = TranscodeJob.query.filter_by(status='running').all()
            for job in stale:
                job.status = 'pending'
                job.started_at = None
            if stale:
                logger.info(f"Reset {len(stale)} stale transcode job(s) to pending on startup")

            db.session.commit()

            if stale:
                _ensure_drain_running(app, paths['data'])
    except Exception as e:
        logger.warning(f"Could not reset stale transcode jobs: {e}")

    if app.config["LDAP_ENABLE"]:
        if ldap is None:
            app.logger.error("LDAP is enabled but python-ldap is not installed. "
                             "Install system dependencies (libldap2-dev libsasl2-dev on Linux, "
                             "openldap on macOS) and run: pip install python-ldap")
            exit(1)
        if not app.config["LDAP_URL"] or not app.config["LDAP_BINDDN"] or not app.config["LDAP_BASEDN"] or not app.config["LDAP_USER_FILTER"]:
            app.logger.error("Missing parameters for LDAP")
            exit(1)
        app.ldap_conn = ldap.initialize(app.config["LDAP_URL"])
        app.ldap_conn.protocol_version = ldap.VERSION3
        app.ldap_conn.simple_bind_s(app.config["LDAP_BINDDN"] + "," + app.config["LDAP_BASEDN"], app.config["LDAP_PASSWORD"])
        app.logger.info("LDAP connection successful")
    
    login_manager = LoginManager()
    login_manager.init_app(app)

    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # blueprint for auth routes in our app
    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint)

    # blueprint for api routes
    from .api import api as api_blueprint
    app.register_blueprint(api_blueprint)

    # blueprint for non-auth parts of app
    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    if init_schedule and os.environ.get('FIRESHARE_START_SCHEDULER') == '1':
        from .schedule import init_schedule as _init_schedule
        _init_schedule(app.config['SCHEDULED_JOBS_DATABASE_URI'],
            app.config['MINUTES_BETWEEN_VIDEO_SCANS'])
    
    #Integrations Validation
    if app.config.get('DISCORD_WEBHOOK_URL'):
        discord_regex = r"^https:\/\/discord\.com\/api\/webhooks\/\d{17,20}\/[\w-]{60,}$"
        if re.match(discord_regex, app.config['DISCORD_WEBHOOK_URL']):
            app.logger.info(f"Discord Integration: URL VALID | ENABLED (URL: {app.config['DISCORD_WEBHOOK_URL'][:20]}...)")
        else:            
            app.logger.error("Discord Webhook URL format looks invalid. Please double-check the URL.")
            sys.exit(1)

    if app.config.get("GENERIC_WEBHOOK_URL") or app.config.get("GENERIC_WEBHOOK_PAYLOAD"):
        if not app.config.get("GENERIC_WEBHOOK_URL") or not app.config.get("GENERIC_WEBHOOK_PAYLOAD"):
            app.logger.error("FATAL: Incomplete Generic Webhook configuration. Both URL and PAYLOAD must be set.")
            sys.exit(1)

        url_regex = r"^https?:\/\/[^\s\/$.?#].[^\s]*$"
        if re.match(url_regex, app.config['GENERIC_WEBHOOK_URL']):
            app.logger.info(f"Generic Webhook: URL VALID | ENABLED ({app.config['GENERIC_WEBHOOK_URL'][:20]}...)")
        else:            
            app.logger.error(f"FATAL: Generic Webhook URL format is invalid: {app.config['GENERIC_WEBHOOK_URL']}")
            sys.exit(1)

        if isinstance(app.config['GENERIC_WEBHOOK_PAYLOAD'], dict):
            app.logger.info("Generic Webhook: PAYLOAD VALID | ENABLED")
        else:
            app.logger.error("FATAL: Generic Webhook PAYLOAD must be a JSON object (dictionary).")
            sys.exit(1)

    from .constants import DEFAULT_CONFIG
    if 'integrations' not in DEFAULT_CONFIG:
        DEFAULT_CONFIG['integrations'] = {}

    update_config(paths['data'] / 'config.json')

    # Only overwrite integration settings in config.json if the env vars are explicitly set.
    # This preserves values the user may have configured via the UI or directly in config.json.
    config_path = paths['data'] / 'config.json'
    with open(config_path, 'r+') as f:
        data = json.load(f)

        if app.config.get('DISCORD_WEBHOOK_URL'):
            data['integrations']['discord_webhook_url'] = app.config['DISCORD_WEBHOOK_URL']
        if app.config.get('GENERIC_WEBHOOK_URL'):
            data['integrations']['generic_webhook_url'] = app.config['GENERIC_WEBHOOK_URL']
        if app.config.get('GENERIC_WEBHOOK_PAYLOAD'):
            data['integrations']['generic_webhook_payload'] = app.config['GENERIC_WEBHOOK_PAYLOAD']

        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

    with app.app_context():
        # db.create_all()

        from sqlalchemy import text as _sa_text
        try:
            with db.engine.connect() as _conn:
                _cols = {row[1] for row in _conn.execute(_sa_text("PRAGMA table_info(video_info)"))}
                if "password_hash" not in _cols:
                    _conn.execute(_sa_text("ALTER TABLE video_info ADD COLUMN password_hash VARCHAR(256)"))
                _conn.commit()
        except Exception:
            pass  # table doesn't exist yet; will be created by flask db upgrade

        from sqlalchemy.exc import OperationalError
        from werkzeug.security import generate_password_hash, check_password_hash
        from .models import User as _User
        try:
            admin = _User.query.filter_by(admin=True, ldap=False).first()
            if not admin and not app.config['DISABLE_ADMINCREATE']:
                username = app.config['ADMIN_USERNAME'] or 'admin'
                admin_user = _User(username=username, password=generate_password_hash(app.config['ADMIN_PASSWORD'] or 'admin', method='pbkdf2:sha256'), admin=True)
                db.session.add(admin_user)
                db.session.commit()
            if admin:
                if app.config['ADMIN_PASSWORD']:
                    try:
                        password_mismatch = not check_password_hash(admin.password, app.config['ADMIN_PASSWORD'])
                    except ValueError:
                        password_mismatch = True  # old hash format (sha256), force reset to pbkdf2:sha256
                    if password_mismatch:
                        row = db.session.query(_User).filter_by(admin=True, ldap=False).first()
                        row.password = generate_password_hash(app.config['ADMIN_PASSWORD'], method='pbkdf2:sha256')
                        db.session.commit()
                if app.config['ADMIN_USERNAME'] and admin.username != app.config['ADMIN_USERNAME']:
                    row = db.session.query(_User).filter_by(admin=True, ldap=False).first()
                    row.username = app.config['ADMIN_USERNAME']
                    db.session.commit()
            # Remove the non-admin demo account when DEMO_MODE is off.
            if not app.config['DEMO_MODE']:
                stale_demo = _User.query.filter_by(username='demo', admin=False).first()
                if stale_demo:
                    db.session.delete(stale_demo)
                    db.session.commit()
            # In DEMO_MODE, ensure a separate non-admin demo account exists.
            # If the admin was previously named 'demo' (old demo mode behavior) and no
            # explicit ADMIN_USERNAME is configured, rename it to 'admin' first.
            if app.config['DEMO_MODE']:
                admin = _User.query.filter_by(admin=True, ldap=False).first()
                if admin and admin.username == 'demo' and not app.config['ADMIN_USERNAME']:
                    admin.username = 'admin'
                    db.session.commit()
                if not _User.query.filter_by(username='demo').first():
                    demo_user = _User(
                        username='demo',
                        password=generate_password_hash('demo', method='pbkdf2:sha256'),
                        admin=False,
                    )
                    db.session.add(demo_user)
                    db.session.commit()
        except OperationalError:
            pass  # tables don't exist yet (e.g. during flask db upgrade), skip init

        return app
