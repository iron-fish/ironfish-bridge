version: '2.4'
services:
  ironfish-node:
    restart: always
    image: "${app_image}"
    command: >-
      ${command}
      %{if command == "start" && override_bootstrap_node}-b '${bootstrap_node}'%{endif}
      -v
      --datadir="/efs"
      %{if command == "start"}--upgrade%{endif}
      %{if command == "start" && network_id != -1}--networkId ${network_id}%{endif}
      %{if command == "start" && node_name != ""}-n ${node_name}%{endif}
      %{if command == "start"}%{if listen_port != 0}-p ${listen_port}%{else}--no-listen%{endif}%{endif}
      %{if rpc_auth_token != ""}--rpc.auth=${rpc_auth_token}%{endif}
      %{if rpc_port != 0}--rpc.tcp %{if rpc_host != ""}--rpc.tcp.host=${rpc_host}%{endif} --rpc.tcp.port=${rpc_port}%{endif}
    ports:
      %{if listen_port != 0}- "${listen_port}:${listen_port}"%{endif}
      %{if command == "start" && rpc_port != 0}- "${rpc_port}:${rpc_port}"%{endif}
    volumes:
      - /efs/${datadir}:/efs

    %{if mem_limit != ""}mem_limit: ${mem_limit}%{endif}

    # Disable core dumps to save disk space
    ulimits:
      core:
        hard: 0
        soft: 0

    logging:
        driver: "json-file"
        options:
            max-file: "4"
            max-size: "25m"
