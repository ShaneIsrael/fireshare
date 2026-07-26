from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from sqlalchemy.pool import StaticPool
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

import logging
from subprocess import Popen

logger = logging.getLogger('fireshare')
logger.setLevel(logging.DEBUG)
_scheduler_app = None

def fireshare_scan():
    logger.info('Starting scheduled scan...')
    Popen(["fireshare", "bulk-import"], shell=False)
    Popen(["fireshare", "scan-images"], shell=False)


def reconcile_machine_uploads():
    if _scheduler_app is None:
        return
    from . import db
    from .machine_upload import reconcile_pending_jobs

    with _scheduler_app.app_context():
        try:
            if inspect(db.engine).has_table("machine_upload_job"):
                reconcile_pending_jobs()
        finally:
            db.session.remove()


def init_schedule(app, dburl, mins_between_scan=5, machine_uploads_enabled=False):
    if mins_between_scan <= 0 and not machine_uploads_enabled:
        return

    global _scheduler_app
    _scheduler_app = app
    engine_options = {
        'poolclass': StaticPool,
        'connect_args': {
            'check_same_thread': False,
        },
    }
    scheduler = BackgroundScheduler(
        jobstores={'default': SQLAlchemyJobStore(url=dburl, engine_options=engine_options)}
    )
    scheduler.start(paused=True)
    if mins_between_scan > 0:
        logger.info(f'Initializing scheduled video scan. minutes={mins_between_scan}')
        scheduler.add_job(fireshare_scan, 'interval', minutes=mins_between_scan, id='fireshare_scan', replace_existing=True)
    else:
        try:
            scheduler.remove_job('fireshare_scan')
        except JobLookupError:
            pass
    if machine_uploads_enabled:
        from .machine_upload import MachineUploadError

        logger.info('Initializing machine upload reconciliation. seconds=60')
        try:
            reconcile_machine_uploads()
        except (MachineUploadError, SQLAlchemyError, OSError):
            logger.warning('Initial machine upload reconciliation failed')
        scheduler.add_job(
            reconcile_machine_uploads,
            'interval',
            seconds=60,
            id='machine_upload_reconcile',
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    else:
        try:
            scheduler.remove_job('machine_upload_reconcile')
        except JobLookupError:
            pass
    scheduler.resume()
    return scheduler
