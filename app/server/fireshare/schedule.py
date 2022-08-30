from tabnanny import check
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

import logging
from subprocess import Popen

logger = logging.getLogger('fireshare')
logger.setLevel(logging.DEBUG)

def fireshare_scan():
    logger.info('Starting scheduled scan...')
    Popen("fireshare bulk-import", shell=True)

def init_schedule(dburl, mins_between_scan=5):
    if mins_between_scan > 0:
        logger.info(f'Initializing scheduled video scan. minutes={mins_between_scan}')
        scheduler = BackgroundScheduler(jobstores={'default': SQLAlchemyJobStore(url=dburl)})
        scheduler.add_job(fireshare_scan, 'interval', minutes=mins_between_scan, id='fireshare_scan', replace_existing=True)
        scheduler.start()
