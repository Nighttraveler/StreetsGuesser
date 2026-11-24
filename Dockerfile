FROM docker.io/library/python:3.13.18-alpine3.24@sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e

RUN addgroup -S arrecifes && adduser -S -D -H -G arrecifes arrecifes \
    && command -v wget >/dev/null
COPY frontend/index.html frontend/play.html frontend/styles.css frontend/game.mjs frontend/app.mjs frontend/arrecifes_calles.json /srv/arrecifes/public/
COPY backend/serve_static.py /srv/arrecifes/serve_static.py

USER arrecifes
EXPOSE 8080/tcp
ENTRYPOINT ["python", "-IBu", "/srv/arrecifes/serve_static.py"]
