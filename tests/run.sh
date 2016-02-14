#!/usr/bin/env bash

cd $(dirname $0)

jasmine-node * --config "TYPESCRIPT_CACHE_DIR" ".cache"
