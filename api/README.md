# ironfish-bridge-api

![Build](https://github.com/iron-fish/ironfish-bridge-api/actions/workflows/ci.yml/badge.svg)

## Installing

* Make sure you're running at least Node 16 - you may want to avail yourself of a tool like [nvm](https://nvm.sh)
* Run `yarn` to install dependencies
* Run `yarn docker:start` to start docker
* Run `yarn build` to build things locally
* Run `yarn db:client:generate` to generate the Prisma client
* Run `yarn db:migrate` to create a migration

## Database

* Run `yarn db:client:generate` to generate the Prisma client
* Run `yarn db:migrate` to create a migration
