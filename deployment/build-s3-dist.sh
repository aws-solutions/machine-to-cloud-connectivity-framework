#!/bin/bash

# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#sudo yum-config-manager --enable epel
#sudo yum update -y
#sudo pip install --upgrade pip
#alias sudo='sudo env PATH=$PATH'
#sudo  pip install --upgrade setuptools
#sudo pip install --upgrade virtualenv

# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name
# source-bucket-base-name should be the base name for the S3 bucket location where the template will source the Lambda code from.
# The template will append '-[region_name]' to this bucket name.
# For example: ./build-s3-dist.sh solutions
# The template will then expect the source code to be located in the solutions-[region_name] bucket

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Please provide the base source bucket name and version (subfolder) where the lambda code will eventually reside.\nFor example: ./build-s3-dist.sh solutions v1.0"
    exit 1
fi

# Build source
echo "Staring to build distribution"
export deployment_dir=`pwd`
export dist_dir="$deployment_dir/dist" 

echo "Creating distribution directory"
mkdir -p dist
echo "In deployment folder"
pwd
echo "Replacing solution bucket in the template"
cp -f "machine-to-cloud-connectivity-framework.template" "dist"
echo "Updating code source bucket in template with $1"
replace="s/%%BUCKET_NAME%%/$1/g"
echo "sed -i -e $replace dist/machine-to-cloud-connectivity-framework.template"
sed -i -e $replace dist/machine-to-cloud-connectivity-framework.template
echo "Updating code version bucket in template with $2"
replace="s/%%VERSION%%/$2/g"
echo "sed -i -e $replace dist/machine-to-cloud-connectivity-framework.template"
sed -i -e $replace dist/machine-to-cloud-connectivity-framework.template

cd ..
echo "Building lambda packages"
pwd
echo "Building job builder lambda module"
cd source/job-builder/opcda-job-builder
zip -r ../../../deployment/dist/opcda-job-builder.zip *
echo "Building connector lambda module"
cd ../../../source/machine-connector/m2c2-opcda-connector
zip -r ../../../deployment/dist/m2c2-opcda-connector.zip *

echo "Completed building distribution"
cd $deployment_dir
