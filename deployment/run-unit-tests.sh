#!/bin/bash
#
# This script runs all tests for the CDK project and Lambda functions.
# These include unit tests and snapshot tests.
#
# The if/then blocks are for error handling. They will cause the script to stop executing if an error is thrown from the
# node process running the test case(s). Removing them or not using them for additional calls with result in the
# script continuing to execute despite an error being thrown.

set -e

# Configure environment variables
template_dir=$PWD
root_dir="${template_dir%/*}"
source_dir="$root_dir/source"
coverage_reports_top_path="$source_dir/test/coverage-reports"

prepare_jest_coverage_report() {
  local component_name=$1

  if [ ! -d "coverage" ]; then
    echo "ValidationError: Missing required directory coverage after running unit tests"
    exit 129
  fi

  # prepare coverage reports
  rm -fr coverage/lcov-report
  mkdir -p $coverage_reports_top_path/jest
  coverage_report_path=$coverage_reports_top_path/jest/$component_name
  rm -fr $coverage_report_path
  mv coverage $coverage_report_path
}

run_typescript_test() {
  local component_path=$1
  local component_name=$2

  echo "------------------------------------------------------------------------------"
  echo "[Test] Run TypeScript unit test with coverage for $component_name"
  echo "------------------------------------------------------------------------------"
  echo "cd $component_path"
  cd $component_path

  # clean and install dependencies
  yarn clean
  yarn install

  # run unit tests
  yarn test

  # prepare coverage reports
  prepare_jest_coverage_report $component_name
}

run_python_test() {
  local component_path=$1
  local component_name=$2

  echo "------------------------------------------------------------------------------"
  echo "[Test] Run Python unit test with coverage for $component_name"
  echo "------------------------------------------------------------------------------"
  python_coverage_report="$coverage_reports_top_path/$component_name.coverage.xml"
  rm -f $python_coverage_report
  cd $component_path

  # run unit tests
  python3 -m pytest -v --tb=long --cov=$component_path \
      --cov-config=tests/.coveragerc \
      --cov-report=term-missing \
      --cov-report "xml:$python_coverage_report"
  sed -i -e "s,<source>$source_dir,<source>source,g" $python_coverage_report
}

# TypeScript packages
declare -a packages=(
  "infrastructure"
  "lib"
  "connection-builder"
  "greengrass-deployer"
  "custom-resource"
  "sqs-message-consumer"
  "timestream-writer"
  "ui"
)

for package in "${packages[@]}"
do
  if [ -d "$source_dir/lambda/$package" ]
  then
    run_typescript_test $source_dir/lambda/$package $package
  else
    run_typescript_test $source_dir/$package $package
  fi

  # Check the result of the test and exit if a failure is identified
  if [ $? -eq 0 ]
  then
    echo "Test for $package passed"
  else
    echo "******************************************************************************"
    echo "TypeScript test FAILED for $package"
    echo "******************************************************************************"
    exit 1
  fi
done

echo "------------------------------------------------------------------------------"
echo "[Init] Clean Python virtual environment"
echo "------------------------------------------------------------------------------"
cd $root_dir
if [ -d ".venv" ]; then
  rm -rf ".venv"
fi

echo "------------------------------------------------------------------------------"
echo "[Init] Create Python virtual environment and installing dev requirements"
echo "------------------------------------------------------------------------------"
python3 -m venv .venv
source .venv/bin/activate
cd $source_dir/machine_connector
pip install -r requirements_dev.txt

# Python packages
declare -a packages=(
  "utils"
  "m2c2_publisher"
  "m2c2_opcda_connector"
  "m2c2_osipi_connector"
  "boilerplate"
)

for package in "${packages[@]}"
do
  run_python_test $source_dir/machine_connector/$package $package

  # Check the result of the test and exit if a failure is identified
  if [ $? -eq 0 ]
  then
    echo "Test for $package passed"
  else
    echo "******************************************************************************"
    echo "Python test FAILED for $package"
    echo "******************************************************************************"
    exit 1
  fi
done

echo "------------------------------------------------------------------------------"
echo "[End] Deactivate Python virtual environment"
echo "------------------------------------------------------------------------------"
deactivate
