from tabnanny import check
from apscheduler.schedulers.background import BackgroundScheduler
import logging
from subprocess import Popen

scheduler = BackgroundScheduler()
logger = logging.getLogger('fireshare')
logger.setLevel(logging.DEBUG)

def fireshare_scan():
    logger.info('Starting scheduled scan...')
    Popen("fireshare bulk-import", shell=True)

def init_schedule():
    logger.info('Initializing scheduled video scan. minutes=5')
    scheduler.add_job(fireshare_scan, 'interval', minutes=5, id='fireshare_scan')
    scheduler.start()
