FROM node:13.8.0

# Update everything on the box
RUN apt-get -y update
RUN apt-get clean

COPY scripts /scripts
COPY src src
COPY package.json package.json
COPY yarn.lock yarn.lock
COPY env.json env.json

RUN yarn install
CMD yarn start
