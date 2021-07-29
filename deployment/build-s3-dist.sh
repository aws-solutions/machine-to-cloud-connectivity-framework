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
echo "Synth CDK Template"
echo "------------------------------------------------------------------------------"
SUB_BUCKET_NAME="s/BUCKET_NAME_PLACEHOLDER/$1/g"
SUB_SOLUTION_NAME="s/SOLUTION_NAME_PLACEHOLDER/$2/g"
SUB_VERSION="s/VERSION_PLACEHOLDER/$3/g"
export overrideWarningsEnabled=false

cd $source_dir/infrastructure
npm install
node_modules/aws-cdk/bin/cdk synth --asset-metadata false --path-metadata false > $template_dir/machine-to-cloud-connectivity-framework.template
sed -e $SUB_BUCKET_NAME -e $SUB_SOLUTION_NAME -e $SUB_VERSION $template_dir/machine-to-cloud-connectivity-framework.template > $template_dist_dir/machine-to-cloud-connectivity-framework.template
rm $template_dir/machine-to-cloud-connectivity-framework.template

echo "------------------------------------------------------------------------------"
echo "Build the common Lambda library"
echo "------------------------------------------------------------------------------"
cd $lambda_source_dir/lib
npm run clean
npm install

declare -a lambda_packages=(
  "connection-builder"
  "custom-resource"
  "greengrass-deployer"
  "sqs-message-consumer"
)

for lambda_package in "${lambda_packages[@]}"
do
  echo "------------------------------------------------------------------------------"
  echo "Build Lambda package: $lambda_package"
  echo "------------------------------------------------------------------------------"
  cd $lambda_source_dir/$lambda_package
  npm run package

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
echo "[Packing] Lambda Packages - OPC DA Connector"
echo "------------------------------------------------------------------------------"
cd $source_dir/machine_connector/m2c2_opcda_connector
rm -rf package
pip3 install -r requirements.txt --target ./package
cp -rf $source_dir/machine_connector/utils package
pip3 install -r $source_dir/machine_connector/utils/requirements.txt --target ./package/utils
cd package
zip -r $build_dist_dir/m2c2-opcda-connector.zip .
cd ..
zip -r $build_dist_dir/m2c2-opcda-connector.zip validations
zip -g $build_dist_dir/m2c2-opcda-connector.zip *.py

echo "------------------------------------------------------------------------------"
echo "[Packing] Lambda Packages - M2C2 Publisher"
echo "------------------------------------------------------------------------------"
cd $source_dir/machine_connector/m2c2_publisher
rm -rf package
pip3 install -r requirements.txt --target ./package
cp -rf $source_dir/machine_connector/utils package
pip3 install -r $source_dir/machine_connector/utils/requirements.txt --target ./package/utils
cd package
zip -r $build_dist_dir/m2c2_publisher.zip .
cd ..
zip -r $build_dist_dir/m2c2_publisher.zip converters targets
zip -g $build_dist_dir/m2c2_publisher.zip *.py

echo "------------------------------------------------------------------------------"
echo "[Build] UI"
echo "------------------------------------------------------------------------------"
cd $source_dir/ui
npm run clean
npm run install:yarn
node_modules/yarn/bin/yarn install
node_modules/yarn/bin/yarn build

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
