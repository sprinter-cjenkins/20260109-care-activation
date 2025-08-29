# Care Activation Infra

This project provisions an AWS infrastructure using **Terraform**.  
It includes VPC creation, public and private subnets, routing tables, NAT Gateways, and optional AWS PrivateLink endpoints.  
The goal is to create a scalable and secure network architecture for AWS resources across multiple environments.

---

## Overview

The Terraform configuration in this project follows a **modular approach** to set up:

- **VPC** with a custom CIDR block  
- **Public and private subnets** across availability zones  
- **Internet Gateway** for public internet access  
- **NAT Gateway** for secure outbound access from private subnets  
- **Route Tables** for traffic routing  
- **Optional AWS PrivateLink** for private connectivity to supported AWS services  

By using **Terraform workspaces**, the same configuration can manage resources in multiple environments (`dev`, `prod`), with isolated states and variables.

---

## Directory Structure

```

.
├── main.tf                # Main Terraform configuration
├── networking/            # Networking module
│   ├── data.tf            # AWS availability zones and region
│   ├── network.tf         # VPC, subnets, routing, gateways
│   ├── outputs.tf         # Output values (IDs, ARNs, etc.)
│   └── variables.tf       # Input variables for networking module
├── variables.tf           # Project-wide variables
├── dev.tfvars             # Dev environment variables
├── prod.tfvars            # Prod environment variables
└── README.md              # Documentation

````

---

## Prerequisites

- **Terraform** ≥ 0.12  
- **AWS Account** with CLI credentials configured  

👉 [Configuring AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

