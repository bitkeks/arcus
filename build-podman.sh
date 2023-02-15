#!/bin/bash

full_path=$(realpath $0)
PROJ=$(dirname $full_path)

podman build -t arcus-builder-f36 -f $PROJ/Containerfile
podman run -ti --rm -v $PROJ:/data:rw,Z arcus-builder-f36 /root/.cargo/bin/wasm-pack build --out-name arcus --target web /data/arcus-wasm/
