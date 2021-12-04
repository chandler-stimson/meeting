FROM node:12-alpine

WORKDIR /opt/app

ENV PORT=80

RUN npm install -g http-server

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

RUN npm run build

CMD [ "http-server", "dist" ]
