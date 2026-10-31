# https://contributors.home-assistant.io/apps/guides/dockerfile/

# The server bundle and the page are built once, on the build machine's platform: the output is the same for every
# arch.
# The node pin is bumped by hand (docs/releasing.md).
FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /build
# Dependencies first, so a change to the source does not reinstall them.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
COPY dev/package.json dev/
RUN npm ci
COPY shared/ shared/
COPY server/ server/
COPY web/ web/
RUN npm run build

FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

ENV NODE_ENV=production

COPY --from=build /build/server/dist/server.mjs /opt/ha-spending/server.mjs
COPY --from=build /build/web/dist /opt/ha-spending/web

CMD ["node", "/opt/ha-spending/server.mjs"]

LABEL \
    io.hass.type="app" \
    org.opencontainers.image.title="Home Assistant App: HA Spending" \
    org.opencontainers.image.description="A household's spending from Firefly III, on a page in Home Assistant." \
    org.opencontainers.image.source="https://github.com/thomas3650/Ha-Spending" \
    org.opencontainers.image.licenses="MIT"
