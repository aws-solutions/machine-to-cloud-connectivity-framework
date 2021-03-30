#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name trademarked-solution-name version-code
#
# Paramenters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#
#  - trademarked-solution-name: name of the solution for consistency
#
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

# Build source
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist, node_modules and bower_components folders"
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
echo "[Packing] CDK Template"
echo "------------------------------------------------------------------------------"
SUB_BUCKET_NAME="s/BUCKET_NAME_PLACEHOLDER/$1/g"
SUB_SOLUTION_NAME="s/SOLUTION_NAME_PLACEHOLDER/$2/g"
SUB_VERSION="s/VERSION_PLACEHOLDER/$3/g"

cd $source_dir/infrastructure
npm install
node_modules/aws-cdk/bin/cdk synth --asset-metadata false --path-metadata false > $template_dir/machine-to-cloud-connectivity-framework.template
sed -e $SUB_BUCKET_NAME -e $SUB_SOLUTION_NAME -e $SUB_VERSION $template_dir/machine-to-cloud-connectivity-framework.template > $template_dist_dir/machine-to-cloud-connectivity-framework.template
rm $template_dir/machine-to-cloud-connectivity-framework.template

echo "------------------------------------------------------------------------------"
echo "[Packing] Lambda Packages - Custom Resource"
echo "------------------------------------------------------------------------------"
cd $source_dir/custom-resource
zip -r $build_dist_dir/m2c2-helper.zip *

echo "------------------------------------------------------------------------------"
echo "[Packing] Lambda Packages - Job Builder"
echo "------------------------------------------------------------------------------"
cd $source_dir/job-builder/m2c2-job-builder
zip -r $build_dist_dir/m2c2-job-builder.zip *

echo "------------------------------------------------------------------------------"
echo "[Packing] Lambda Packages - OPC DA Connector"
echo "------------------------------------------------------------------------------"
cd $source_dir/machine-connector/m2c2-opcda-connector
rm -rf package
pip3 install -r requirements.txt --target ./package
cp -rf $source_dir/machine-connector/connector package
cd package
zip -r $build_dist_dir/m2c2-opcda-connector.zip .
cd ..
zip -g $build_dist_dir/m2c2-opcda-connector.zip *.py

echo "------------------------------------------------------------------------------"
echo "[Packing] Lambda Packages - SLMP Connector"
echo "------------------------------------------------------------------------------"
cd $source_dir/machine-connector/m2c2-slmp-connector
rm -rf package
pip3 install -r requirements.txt --target ./package
cd package
zip -r $build_dist_dir/m2c2-slmp-connector.zip .
cd ..
zip -g $build_dist_dir/m2c2-slmp-connector.zip *.py
