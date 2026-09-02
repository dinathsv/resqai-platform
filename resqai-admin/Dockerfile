FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# We can run in dev mode to allow hot-reloading if we mount volumes,
# but for a simple "run everything" setup, dev mode is easiest without builds.
EXPOSE 3000

CMD ["npm", "run", "dev"]
