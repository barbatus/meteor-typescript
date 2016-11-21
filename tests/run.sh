#!/usr/bin/env bash

cd $(dirname $0)

rm -fr ".cache"

npm install

istanbul cover jasmine-node -- --config "TYPESCRIPT_CACHE_DIR" ".cache" *
