FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production DATA_DIR=/app/data PORT=8080
EXPOSE 8080
VOLUME ["/app/data"]
CMD ["node","server.mjs"]
