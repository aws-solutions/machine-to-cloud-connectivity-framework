#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name solution-name version-code
#
# Paramenters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#  - solution-name: name of the solution for consistency
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo "# Please provide all required parameters for the build script."
  echo "For example: ./build-s3-dist.sh solutions solution-name v1.0.0"
  exit 1
fi

# Build source
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"
lambda_source_dir="$source_dir/lambda"
root_dir="${template_dir%/*}"

echo "------------------------------------------------------------------------------"
echo "Clean up old build files"
echo "------------------------------------------------------------------------------"
echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir

echo "------------------------------------------------------------------------------"
echo "Run ESLint and prettier"
echo "------------------------------------------------------------------------------"
cd $source_dir
yarn clean:lint

# Check the result of ESLint and prettier
if [ $? -eq 0 ]
then
  echo "All TypeScript source codes are linted."
else
  echo "******************************************************************************"
  echo "ESLint and prettier FAILED"
  echo "******************************************************************************"
  exit 1
fi

echo "------------------------------------------------------------------------------"
echo "[autopep8] Clean Python virtual environment"
echo "------------------------------------------------------------------------------"
cd $root_dir
if [ -d ".venv" ]; then
  rm -rf ".venv"
fi

echo "------------------------------------------------------------------------------"
echo "[autopep8] Create Python virtual environment"
echo "------------------------------------------------------------------------------"
python3 -m venv .venv
source .venv/bin/activate
pip3 install autopep8

echo "------------------------------------------------------------------------------"
echo "[autopep8] Run autopep8"
echo "------------------------------------------------------------------------------"
cd $source_dir
autopep8 --diff --recursive --exclude="**/package/*" --exit-code ./machine_connector

# Check the result of autopep8
if [ $? -eq 0 ]
then
  echo "All Python source codes are linted."
  deactivate
else
  echo "******************************************************************************"
  echo "autopep8 FAILED"
  echo "******************************************************************************"
  exit 1
fi

echo "------------------------------------------------------------------------------"
echo "Synth CDK Template"
echo "------------------------------------------------------------------------------"
export BUCKET_NAME_PLACEHOLDER=$1
export SOLUTION_NAME_PLACEHOLDER=$2
export VERSION_PLACEHOLDER=$3
export overrideWarningsEnabled=false

cd $source_dir/infrastructure
yarn clean
yarn install
node_modules/aws-cdk/bin/cdk synth --asset-metadata false --path-metadata false > $template_dist_dir/machine-to-cloud-connectivity-framework.template

if [ $? -ne 0 ]
then
  echo "******************************************************************************"
  echo "cdk-nag found errors"
  echo "******************************************************************************"
  exit 1
fi

echo "------------------------------------------------------------------------------"
echo "Build the common Lambda library"
echo "------------------------------------------------------------------------------"
cd $lambda_source_dir/lib
yarn clean
yarn install

declare -a lambda_packages=(
  "connection-builder"
  "custom-resource"
  "greengrass-deployer"
  "sqs-message-consumer"
  "timestream-writer"
)

for lambda_package in "${lambda_packages[@]}"
do
  echo "------------------------------------------------------------------------------"
  echo "Build Lambda package: $lambda_package"
  echo "------------------------------------------------------------------------------"
  cd $lambda_source_dir/$lambda_package
  yarn package

  # Check the result of the package step and exit if a failure is identified
  if [ $? -eq 0 ]
  then
    echo "Package for $lambda_package built successfully"
  else
    echo "******************************************************************************"
    echo "Lambda package build FAILED for $lambda_package"
    echo "******************************************************************************"
    exit 1
  fi

  mv dist/package.zip $build_dist_dir/$lambda_package.zip
  rm -rf dist
done

echo "------------------------------------------------------------------------------"
echo "Build the machine connector"
echo "------------------------------------------------------------------------------"
machine_connector_dir="$source_dir/machine_connector"

echo "------------------------------------------------------------------------------"
echo "Clean the machine connector directory"
echo "------------------------------------------------------------------------------"
find $machine_connector_dir -iname "__pycache__" -type d -exec rm -rf "{}" \; 2> /dev/null
find $machine_connector_dir -iname ".pytest_cache" -type d -exec rm -rf "{}" \; 2> /dev/null
find $machine_connector_dir -type f -name '.coverage' -delete

declare -a machine_connector_packages=(
  "m2c2_opcda_connector"
  "m2c2_publisher"
)

for machine_connector_package in "${machine_connector_packages[@]}"
do
  echo "------------------------------------------------------------------------------"
  echo "Build package: $machine_connector_package"
  echo "------------------------------------------------------------------------------"
  cd $machine_connector_dir/$machine_connector_package
  rm -rf package && mkdir package

  rsync -avrq ./ package --exclude package --exclude tests
  rsync -avrq $machine_connector_dir/utils/ package/utils --exclude tests

  cd package
  zip -r $build_dist_dir/$machine_connector_package.zip ./
  cd $machine_connector_dir/$machine_connector_package
  rm -rf package
done

echo "------------------------------------------------------------------------------"
echo "[Build] UI"
echo "------------------------------------------------------------------------------"
cd $source_dir/ui
yarn build

if [ $? -ne 0 ]
then
  echo "******************************************************************************"
  echo "UI build FAILED"
  echo "******************************************************************************"
  exit 1
fi

mkdir $build_dist_dir/ui
cp -r ./build/* $build_dist_dir/ui

echo "------------------------------------------------------------------------------"
echo "[Create] UI manifest"
echo "------------------------------------------------------------------------------"
cd $build_dist_dir
manifest=(`find ui -type f | sed 's|^./||'`)
manifest_json=$(IFS=,;printf "%s" "${manifest[*]}")
echo "[\"$manifest_json\"]" | sed 's/,/","/g' >> $build_dist_dir/manifest.json
