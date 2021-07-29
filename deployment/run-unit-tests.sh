#!/bin/bash
#
# This script runs all tests for the CDK project and Lambda functions.
# These include unit tests and snapshot tests.
#
# The if/then blocks are for error handling. They will cause the script to stop executing if an error is thrown from the
# node process running the test case(s). Removing them or not using them for additional calls with result in the
# script continuing to execute despite an error being thrown.

set -e

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
  npm run clean
	npm install

  # run unit tests
  npm test

  # prepare coverage reports
	prepare_jest_coverage_report $component_name
}

# Configure environment variables
template_dir=$PWD
root_dir="${template_dir%/*}"
source_dir="$root_dir/source"
coverage_reports_top_path="$source_dir/test/coverage-reports"

# Test packages
declare -a packages=(
  "infrastructure"
  "lib"
  "connection-builder"
  "greengrass-deployer"
  "custom-resource"
  "sqs-message-consumer"
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
    echo "Lambda test FAILED for $package"
    echo "******************************************************************************"
    exit 1
  fi
done

# Test UI
cd $source_dir/ui
npm run clean
npm run install:yarn
node_modules/yarn/bin/yarn install
node_modules/yarn/bin/yarn test
prepare_jest_coverage_report ui

if [ $? -eq 0 ]
then
  echo "Test for ui passed"
else
  echo "******************************************************************************"
  echo "Lambda test FAILED for ui"
  echo "******************************************************************************"
  exit 1
fi

echo "------------------------------------------------------------------------------"
echo "[Init] Clean Python virtual environment"
echo "------------------------------------------------------------------------------"
cd $root_dir
if [ -d ".venv" ]; then
  rm -rf ".venv"
fi

echo "------------------------------------------------------------------------------"
echo "[Init] Create Python virtual environment"
echo "------------------------------------------------------------------------------"
python3 -m venv .venv
source .venv/bin/activate

echo "------------------------------------------------------------------------------"
echo "[Test] Python unit tests"
echo "------------------------------------------------------------------------------"
cd $source_dir/machine_connector/m2c2_publisher
pip install -r tests/requirements_dev.txt
cd $source_dir/machine_connector
python_coverage_report="$coverage_reports_top_path/machine_connector.coverage.xml"
echo "coverage report path set to $python_coverage_report"
coverage run --include=${source_dir}/machine_connector/utils --omit=${source_dir}/machine_connector/m2c2_opcda_connector,${source_dir}machine_connector/m2c2_publisher -m pytest tests -v --tb=long --cov=${source_dir}/machine_connector --cov-report=term-missing --cov-report "xml:$python_coverage_report"
sed -i -e "s,<source>$source_dir,<source>source,g" $python_coverage_report
python_coverage_report="$coverage_reports_top_path/m2c2_publisher.coverage.xml"
echo "coverage report path set to $python_coverage_report"
cd $source_dir/machine_connector/m2c2_publisher
cp -r $source_dir/machine_connector/utils .
coverage run --omit=${source_dir}/machine_connector/m2c2_publisher/utils -m pytest tests -v --cov=${source_dir}/machine_connector/m2c2_publisher --cov-report=term-missing --cov-report "xml:$python_coverage_report"
sed -i -e "s,<source>$source_dir,<source>source,g" $python_coverage_report
rm -rf $source_dir/machine_connector/m2c2_publisher/utils
echo "------------------------------------------------------------------------------"
echo "[End] Deactivate Python virtual environment"
echo "------------------------------------------------------------------------------"
deactivate

