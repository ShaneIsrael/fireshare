#Setup Virtual Environment
python -m venv venv
source venv/bin/activate
source .env.dev

python -m pip install -r app/server/requirements.txt
cd app/server && python setup.py install && cd ../..

flask db upgrade
flask run --with-threads