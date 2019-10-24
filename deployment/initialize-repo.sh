#!/bin/bash

# This script deploys all the dependencies to the GIT Repo
echo "export deployment_dir=`pwd`"
export deployment_dir=`pwd`
echo "mkdir temp"
mkdir temp
echo "cd temp"
cd temp

echo "Retrieving Pyro3 libraries"
echo "git clone https://github.com/irmen/Pyro3"
git clone https://github.com/irmen/Pyro3
echo "cd Pyro3"
cd Pyro3
echo "cp -R Pyro $deployment_dir/source/machine-connector/m2c2-opcda-connector/"
cp -R Pyro ../../../source/machine-connector/m2c2-opcda-connector/
echo "cd $deployment_dir/temp"
cd $deployment_dir/temp

echo "Retrieving OpenOPC libraries"
echo "git clone https://github.com/barrybb/OpenOPC"
git clone https://github.com/barrybb/OpenOPC
echo "cd OpenOPC/src/"
cd OpenOPC/src/
echo "cp OpenOPC.py $deployment_dir/source/machine-connector/m2c2-opcda-connector/"
cp OpenOPC.py ../../../../source/machine-connector/m2c2-opcda-connector/
echo "cd $deployment_dir/temp"
cd $deployment_dir/temp

echo "Retrieving GreenGrassSDK libraries"
echo "git clone https://github.com/aws/aws-greengrass-core-sdk-python"
git clone https://github.com/aws/aws-greengrass-core-sdk-python
echo "cd aws-greengrass-core-sdk-python/"
cd aws-greengrass-core-sdk-python/
echo "cp -R greengrasssdk $deployment_dir/source/machine-connector/m2c2-opcda-connector/"
cp -R greengrasssdk ../../../source/machine-connector/m2c2-opcda-connector/
echo "cp -R greengrasssdk $deployment_dir/source/machine-connector/m2c2-slmp-connector/"
cp -R greengrasssdk ../../../source/machine-connector/m2c2-slmp-connector/
echo "cd $deployment_dir"
cd $deployment_dir
chmod -R 755 temp
echo "rm -R temp"
rm -R temp
