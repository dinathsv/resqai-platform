FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# Package downloads happen while the image is being built, before Compose's
# service-level DNS settings take effect.  Make npm tolerate slow or flaky
# registry connections and retry a failed install from a clean state.
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
RUN set -eux; \
    npm config set registry https://registry.npmjs.org/; \
    npm config set fetch-timeout 600000; \
    npm config set fetch-retries 8; \
    npm config set fetch-retry-mintimeout 10000; \
    npm config set fetch-retry-maxtimeout 600000; \
    attempt=1; \
    max_attempts=4; \
    until npm ci --legacy-peer-deps --no-audit --fund=false; do \
      if [ "$attempt" -ge "$max_attempts" ]; then \
        echo "npm install failed after $max_attempts attempts" >&2; \
        exit 1; \
      fi; \
      echo "npm install failed; retrying in $((attempt * 15)) seconds..." >&2; \
      npm cache clean --force; \
      rm -rf node_modules; \
      sleep "$((attempt * 15))"; \
      attempt=$((attempt + 1)); \
    done

COPY . .

EXPOSE 8081
CMD ["sh", "-c", "if [ ! -d /app/node_modules/expo-splash-screen ] || [ ! -d /app/node_modules/expo-image-picker ]; then npm install --prefer-offline --no-audit --fund=false; fi && exec npm run web"]
