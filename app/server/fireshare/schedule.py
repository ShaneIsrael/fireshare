from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from sqlalchemy.pool import StaticPool

import logging
from subprocess import Popen

logger = logging.getLogger('fireshare')
logger.setLevel(logging.DEBUG)

def fireshare_scan():
    logger.info('Starting scheduled scan...')
    Popen(["fireshare", "bulk-import"], shell=False)
    Popen(["fireshare", "scan-images"], shell=False)

def init_schedule(dburl, mins_between_scan=5):
    if mins_between_scan <= 0:
        # MINUTES_BETWEEN_VIDEO_SCANS=0 turns the automatic scan off. The scheduler is
        # never started, so any job left in the jobstore by a previous run stays dormant
        # (and is replaced by add_job below if scans are re-enabled later).
        logger.info('Automatic video scan is disabled (MINUTES_BETWEEN_VIDEO_SCANS=0). '
                    'Use the manual scan in the admin panel to pick up new files.')
        return

    logger.info(f'Initializing scheduled video scan. minutes={mins_between_scan}')
    # Configure SQLite connection for better concurrency handling
    # StaticPool maintains a single persistent connection per worker process
    engine_options = {
        'poolclass': StaticPool,
        'connect_args': {
            'check_same_thread': False,
        },
    }
    scheduler = BackgroundScheduler(
        jobstores={'default': SQLAlchemyJobStore(url=dburl, engine_options=engine_options)}
    )
    scheduler.add_job(fireshare_scan, 'interval', minutes=mins_between_scan, id='fireshare_scan', replace_existing=True)
    scheduler.start()
