FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Force IPv4 DNS resolution and increase npm timeouts
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retries 5 && \
    npm install --legacy-peer-deps

COPY . .

EXPOSE 8081
CMD ["npm", "run", "web"]