#!/usr/bin/env bash

npm install

cd $(dirname $0)

rm -fr ".cache"

istanbul cover jasmine-node -- --config "TYPESCRIPT_CACHE_DIR" ".cache" *
