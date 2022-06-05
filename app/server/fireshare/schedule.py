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

def init_schedule(dburl):
    logger.info('Initializing scheduled video scan. minutes=5')
    scheduler = BackgroundScheduler(jobstores={'default': SQLAlchemyJobStore(url=dburl)})
    scheduler.add_job(fireshare_scan, 'interval', minutes=5, id='fireshare_scan')
    scheduler.start()
