FROM node:18.2-slim as client
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY app/client/package.json ./
COPY app/client/package-lock.json ./
RUN npm ci --silent
RUN npm install react-scripts@5.0.1 -g --silent

COPY app/client/ ./
RUN npm run build

FROM python:3.9-slim-buster
WORKDIR /

RUN mkdir /data

COPY app/server/requirements.txt ./
COPY app/server/ ./app
COPY --from=client /app/build ./app/build

RUN pip install -r ./requirements.txt

ENV FLASK_ENV production
ENV DATA_DIRECTORY /data
ENV ADMIN_PASSWORD admin

EXPOSE 5000

CMD ["gunicorn", "-b", ":5000", "app:create_app()"]