FROM node:22-bookworm
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Containers reach the API by its Compose service name. Native npm start keeps
# the original localhost:5000 proxy in the source package.json.
RUN node -e "const fs = require('fs'); const p = require('./package.json'); p.proxy = 'http://backend:5000'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2));"
EXPOSE 3000
CMD ["npm", "start"]
