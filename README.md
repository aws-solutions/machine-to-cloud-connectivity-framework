## Machine To Cloud Connectivity Framework

AWS offers the Machine to Cloud Connectivity (M2C2) framework to help customers
connect factory equipment such as PLCs, CNC Machines, OPC DA servers more easily and
securely. This solution provides a framework to define communication with factory
equipment from the AWS cloud. This solution is designed to work out-of-the-box to
connect equipment that support Open Protocol Communication Data Access (OPC DA)
and customers can use this solution as a reference implementation to build connectors
for other protocols within their factory as per their needs.

M2C2 for OPC DA provides a framework where customers can define the OPC DA
supported equipment they want to connect to, the tags from that equipment that you wish
to read and the frequency at which customers would like to read. This data will then be
available in AWS IoT Core for them to either push to their own data lake and visualize the
data, run machine learning for use cases such as predictive maintenance of factory
equipment, create notifications and alerts or integrate one of the many other services
within the IoT Rule engine.

 
For more information and a detailed deployment guide visit the Machine to Cloud Connectivity Framework at https://aws.amazon.com/solutions/machine-to-cloud-connectivity


## Building distributable for customization
* Configure the bucket name of your target Amazon S3 distribution bucket in the buildspec.yml file
```
export DIST_OUTPUT_BUCKET=my-bucket-name # bucket where customized code will reside 
export VERSION=my-version # version number for the customized code 
```
_Note:_ You would have to create an S3 bucket with the prefix 'my-bucket-name-<aws_region>'; aws_region is where you are testing the customized solution. Also, the assets in bucket should be publicly accessible.

* Now build the distributable: 
``` 
cd deployment
chmod +x ./build-s3-dist.sh \n 
./build-s3-dist.sh $DIST_OUTPUT_BUCKET $VERSION \n 
``` 
These will add the following dependencies to the project:
Greengrass SDK - https://github.com/aws/aws-greengrass-core-sdk-python
Pyro3 - https://github.com/irmen/Pyro3
OpenOPC for Python -  https://github.com/barrybb/OpenOPC


* Deploy the distributable to an Amazon S3 bucket in your account. _Note:_ you must have the AWS Command Line Interface installed. 
``` 
aws s3 cp ./dist/ s3://my-bucket-name-<aws_region>/machine-to-cloud-connectivity-framework/<my-version>/ --recursive --acl bucket-owner-full-control --profile aws-cred-profile-name \n 
``` 
 
* Get the link of the machine-to-cloud-connectivity-framework.template uploaded to your Amazon S3 bucket. 
* Deploy the Machine to Cloud Connectivity Framework to your account by launching a new AWS CloudFormation stack using the link of the machine-to-cloud-connectivity-framework.template.

## License

This library is licensed under the Apache 2.0 License. 