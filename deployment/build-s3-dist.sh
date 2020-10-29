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
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name and version (subfolder) where the lambda code will eventually reside.\nFor example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0"
    exit 1
fi

# Build source
echo "Staring to build distribution"
export deployment_dir=`pwd`
export dist_dir="$deployment_dir/dist" 
template_dist_dir="$deployment_dir/global-s3-assets"
build_dist_dir="$deployment_dir/regional-s3-assets"

echo "------------------------------------------------------------------------------"
	 echo "[Init] Clean old dist, node_modules and bower_components folders"
echo "------------------------------------------------------------------------------"

echo "Creating distribution directory"
mkdir -p dist
echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir



echo "In deployment folder"
pwd
echo "Replacing solution bucket in the template"
cp -f "machine-to-cloud-connectivity-framework.template" $template_dist_dir
echo "Updating code source bucket in template with $1"
replace="s/%%BUCKET_NAME%%/$1/g"
echo "sed -i -e $replace $template_dist_dir/machine-to-cloud-connectivity-framework.template"
sed -i -e $replace $template_dist_dir/machine-to-cloud-connectivity-framework.template
echo "Updating code solution name in template with $2"
replace="s/%%SOLUTION_NAME%%/$2/g"
echo "sed -i -e $replace $template_dist_dir/machine-to-cloud-connectivity-framework.template"
sed -i -e $replace $template_dist_dir/machine-to-cloud-connectivity-framework.template
echo "Updating code version bucket in template with $3"
replace="s/%%VERSION%%/$3/g"
echo "sed -i -e $replace $template_dist_dir/machine-to-cloud-connectivity-framework.template"
sed -i -e $replace $template_dist_dir/machine-to-cloud-connectivity-framework.template


cd ..
echo "Building lambda packages"
pwd
echo "Building helper function custom resource lambda module"
cd source/custom-resource
zip -r $build_dist_dir/m2c2-helper.zip *
echo "Building job builder lambda module"
cd ../job-builder/m2c2-job-builder
zip -r $build_dist_dir/m2c2-job-builder.zip *
echo "Building connector opcda lambda module"
cd ../../../source/machine-connector/m2c2-opcda-connector
zip -r $build_dist_dir/m2c2-opcda-connector.zip *
echo "Building connector slmp lambda module"
cd ../../../source/machine-connector/m2c2-slmp-connector
zip -r $build_dist_dir/m2c2-slmp-connector.zip *
echo "Completed building distribution"
cd $deployment_dir
pwd
