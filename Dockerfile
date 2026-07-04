FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/data && chown -R app:app /app/data
USER app

CMD ["node", "src/index.js"]
