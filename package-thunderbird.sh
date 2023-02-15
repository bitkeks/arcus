#!/bin/bash

full_path=$(realpath $0)
PROJ=$(dirname $full_path)

cd $PROJ/thunderbird
TARGET_ZIP=$PROJ/arcus-thunderbird-$(git rev-parse --short release).zip

#~ mkdir -p pkg
cp -av $PROJ/arcus-wasm/pkg/arcus.js ./arcus.js
cp -av $PROJ/arcus-wasm/pkg/arcus_bg.wasm ./arcus_bg.wasm

if [ -f "$TARGET_ZIP" ]; then
	echo "Deleting existing ZIP file"
	rm $TARGET_ZIP
fi

zip -9 -rv $TARGET_ZIP ./
