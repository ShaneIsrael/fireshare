import os
import os.path
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS
from pathlib import Path

# init SQLAlchemy so we can use it later in our models
db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__, static_url_path='', static_folder='build', template_folder='build')
    CORS(app, supports_credentials=True)
    if 'DATA_DIRECTORY' not in os.environ:
        raise Exception("DATA_DIRECTORY not found in environment")

    app.config['ENVIRONMENT'] = os.getenv('ENVIRONMENT')
    app.config['SECRET_KEY'] = 'secret-key-goes-here'
    app.config['DATA_DIRECTORY'] = os.getenv('DATA_DIRECTORY')
    app.config['VIDEO_DIRECTORY'] = os.getenv('VIDEO_DIRECTORY')
    app.config['PROCESSED_DIRECTORY'] = os.getenv('PROCESSED_DIRECTORY')
    app.config['ADMIN_PASSWORD'] = os.getenv('ADMIN_PASSWORD')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{app.config["DATA_DIRECTORY"]}/db.sqlite'

    paths = {
        'data': Path(app.config['DATA_DIRECTORY']),
        'video': Path(app.config['VIDEO_DIRECTORY']),
        'processed': Path(app.config['PROCESSED_DIRECTORY']),
    }
    app.config['PATHS'] = paths
    for k, path in paths.items():
        if not path.is_dir():
            print(f"Creating {k} directory at {str(path)}")
            path.mkdir(parents=True, exist_ok=True)
    subpaths = [
        paths['processed'] / 'video_links',
        paths['processed'] / 'derived',
    ]
    for subpath in subpaths:
        if not subpath.is_dir():
            print(f"Creating subpath directory at {str(subpath.absolute())}")
            subpath.mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)

    login_manager = LoginManager()
    login_manager.init_app(app)

    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # blueprint for auth routes in our app
    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint)

    # blueprint for api routes
    from .api import api as api_blueprint
    app.register_blueprint(api_blueprint)

    # blueprint for non-auth parts of app
    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    with app.app_context():
        # db.create_all()
        return app