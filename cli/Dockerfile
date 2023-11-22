FROM node:18-bullseye as build

COPY ./ /usr/src/ironfish-bridge-cli

RUN /usr/src/ironfish-bridge-cli/scripts/build.sh

FROM node:18-bullseye-slim

VOLUME /root/.ironfish
ENV NODE_ENV production

COPY --from=build /usr/src/ironfish-bridge-cli/build.cli/ironfish-bridge-cli /usr/share/ironfish-bridge-cli
COPY --from=build --chmod=755 /usr/src/ironfish-bridge-cli/scripts/docker-entrypoint.sh /usr/bin/ironfish-bridge-cli

ENTRYPOINT ["/usr/bin/ironfish-bridge-cli"]
CMD ["start", "--rpc.ipc", "--rpc.tcp"]
