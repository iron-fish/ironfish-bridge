# Bridge Terraform

## tl;dr

Login to aws on your machine. From the corresponding `region` folder, run `terraform init && terraform apply`. Note that you may need to run the command twice for all resources to be successfully created. Also wait a few minutes after applying for services to connect properly, as DNS entries have to be created/propogated for the underlying services.

## Outline

This submodule assumes the user will run the bridge on AWS. It is possible to deploy on any cloud provider, but this module will only act as a reference example if you are not deploying on AWS.

## Modules

1. `modules/aws`: Deploys base infrastructure that can be reused for all attached AWS infrastructure. IE VPC, subnets, security groups, file systems, etc.

1. `modules/node`: contains everything required for deploying an ironfish node from source. The node that is referenced is the latest release version seen in the [github repo](https://github.com/iron-fish/ironfish/releases)

1. `modules/api`: deploys business logic and endpoints for operating the bridge. The service commands interface with the api for storing bridge status and transactions in an attached PostgreSQL database.

1. `modules/cli`: deploys a copy of the code from the `ironfish-bridge/cli` in order to run chain scanning for transactions relevant to the bridge. The CLI connects to the running node deployed by the `modules/node`.

## Regions

Define a region to deploy the services and import the necessary modules. A full example deployment is found in `regions/ca-central-1`.

### tfvars

Set the `terraform.tfvars` needed to keep your system secure and connected. See `variables.tf` for all possible variables.

### tfstate

Note that no system is set in place to store tfstate. It is possible to just store this in version control, but you would only want to do this if a fork of this repository is private. Otherwise setting up remote state would likely be the best choice.
