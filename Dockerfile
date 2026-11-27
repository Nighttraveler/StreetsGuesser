FROM docker.io/library/node:22.22.3-alpine@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd

WORKDIR /srv/arrecifes
RUN mkdir -p /var/lib/arrecifes/state \
    && chown node:node /var/lib/arrecifes/state \
    && chmod 0700 /var/lib/arrecifes/state

COPY frontend/app.mjs frontend/arrecifes_calles.json frontend/game.mjs frontend/index.html frontend/play.html frontend/ranked-game-client.mjs frontend/rankings-ui.mjs frontend/styles.css frontend/
COPY backend/ranked-game/backup.mjs backend/ranked-game/catalog.mjs backend/ranked-game/database.mjs backend/ranked-game/errors.mjs backend/ranked-game/http.mjs backend/ranked-game/identity.mjs backend/ranked-game/server.mjs backend/ranked-game/service.mjs backend/ranked-game/
COPY backend/ranked-game/migrations/001-rankings.sql backend/ranked-game/migrations/
COPY backend/rankings/service.mjs backend/rankings/validation.mjs backend/rankings/

USER node
ENTRYPOINT ["node", "--experimental-sqlite", "backend/ranked-game/server.mjs"]
