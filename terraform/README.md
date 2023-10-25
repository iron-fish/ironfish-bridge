# Bridge Terraform

## tl;dr

Login to aws on your machine. From a configured region folder run `terraform init && terraform apply` (see [regions/ca-central-1](regions/ca-central-1/main.tf) for an example). Note that you may need to run the command twice for all resources to be successfully created. You will need to update the variable `az` and `bridge_name` to change the hosted region and bridge resource name respectively.

## Outline

This submodule assumes the user will run the bridge on AWS. It is possible to deploy on any cloud provider, but this module will only act as a reference example if you are not deploying on AWS.

## Modules

1. `modules/node` - contains everything required for deploying an ironfish node from source. The node that is referenced is the latest release version seen in the [github repo](https://github.com/iron-fish/ironfish/releases). The node will run inside an docker container, on an ec2 instance, inside of elastic beanstalk. This was chosen so that there is no configuration required for bootstrapping.

1. `modules/aws` - configures the AWS account level details like route53 and VPC.

1. `modules/api` - TODO

## Regions

This is where the deployment configuration should live for your bridge instances. See the [main.tf](regions/ca-central-1/main.tf) for an example configuration of a bridge node. By creating a new folder and reconfiguring the `node` module, you can deploy to whichever AWS region.
