#!/bin/bash

# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh

current_dir=$PWD
source_dir=$current_dir/../source

# CDK unit tests
cd $source_dir/infrastructure
npm install
npm test