import os, sys, re
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
handler = logging.StreamHandler()
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
        
        # Set busy timeout to 5 seconds (instead of failing immediately)
        cursor.execute("PRAGMA busy_timeout = 5000")
        
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
    logger.info("Validating configuration file...")
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

    from .constants import DEFAULT_CONFIG
    if not path.exists():
        path.write_text(json.dumps(DEFAULT_CONFIG, indent=2))

    with open(path, 'r+') as configfile:
        try:
            current = json.load(configfile)
        except:
            logger.error(f"Invalid config.json file at {str(path)}, exiting...")
            sys.exit()
        updated = combine(DEFAULT_CONFIG, current)
        path.write_text(json.dumps(updated, indent=2))
        configfile.close()

def create_app(init_schedule=False):
    app = Flask(__name__, static_url_path='', static_folder='build', template_folder='build')
    CORS(app, supports_credentials=True)
    if 'DATA_DIRECTORY' not in os.environ:
        raise Exception("DATA_DIRECTORY not found in environment")

    app.config['ENVIRONMENT'] = os.getenv('ENVIRONMENT')
    app.config['DOMAIN'] = os.getenv('DOMAIN')
    app.config['THUMBNAIL_VIDEO_LOCATION'] = int(os.getenv('THUMBNAIL_VIDEO_LOCATION') or 0)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32)) 
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
    if app.config['DEMO_MODE']:
        app.config['ADMIN_USERNAME'] = 'demo'
        app.config['ADMIN_PASSWORD'] = 'demo'
    app.config['ENABLE_TRANSCODING'] = (
        False if app.config['DEMO_MODE']
        else os.getenv('ENABLE_TRANSCODING', '').lower() in ('true', '1', 'yes')
    )
    app.config['TRANSCODE_GPU'] = os.getenv('TRANSCODE_GPU', '').lower() in ('true', '1', 'yes')
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
    app.config['PATHS'] = paths
    for k, path in paths.items():
        if not path.is_dir():
            logger.info(f"Creating {k} directory at {str(path)}")
            path.mkdir(parents=True, exist_ok=True)
    subpaths = [
        paths['processed'] / 'video_links',
        paths['processed'] / 'image_links',
        paths['processed'] / 'derived',
    ]
    for subpath in subpaths:
        if not subpath.is_dir():
            logger.info(f"Creating subpath directory at {str(subpath.absolute())}")
            subpath.mkdir(parents=True, exist_ok=True)

    # Clean up any leftover chunk files from interrupted uploads
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

    if init_schedule:
        from .schedule import init_schedule
        init_schedule(app.config['SCHEDULED_JOBS_DATABASE_URI'],
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
        except OperationalError:
            pass  # tables don't exist yet (e.g. during flask db upgrade), skip init

        return app
