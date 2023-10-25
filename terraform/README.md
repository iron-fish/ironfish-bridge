# Bridge Terraform

## tl;dr

Login to aws on your machine. From this folder run `terraform init && terraform apply`. Note that you may need to run the command twice for all resources to be successfully created.

## Outline

This submodule assumes the user will run the bridge on AWS. It is possible to deploy on any cloud provider, but this module will only act as a reference example if you are not deploying on AWS.

## Modules

1. The `modules/node` module contains everything required for deploying an ironfish node from source. The node that is referenced is the latest release version seen in the [github repo](https://github.com/iron-fish/ironfish/releases)