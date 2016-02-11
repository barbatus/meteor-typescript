#!/usr/bin/env bash

cd $(dirname $0)
TEST_DIR=$(pwd)

TYPESCRIPT_CACHE_DIR=${TEST_DIR}/.cache
export TYPESCRIPT_CACHE_DIR

node tests.js
