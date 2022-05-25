# Fireshare

Self host your media and share with unique links

---

[![Publish Docker Image](https://github.com/ShaneIsrael/fireshare/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/ShaneIsrael/fireshare/actions/workflows/docker-publish.yml)

# Server

```
pip install -e app/server/
```

then source the dev env vars.

```
source .env.dev
```

run the flask app

```
flask run
```

# Client

navigate to the client root and install dependencies

```
cd app/client && npm i
```

start the react dev server

```
npm start
```

Navigate to `http://localhost:3000`

In production, flask will serve the react app and it will be access at `http://localhost:5000` from within
the docker container.
