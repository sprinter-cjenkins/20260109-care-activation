Here’s a clean, professional **README.md** for your `ssm-rds-auto-connect.sh` script 👇

---

# 🧩 SSM RDS Auto Connect Script

This Bash script automates connecting to an **Amazon RDS instance** through an **EC2 bastion host** using **AWS Systems Manager (SSM) Port Forwarding** — without the need for a public database endpoint.

---

## 📋 Overview

The script:
1. Export your AWS Profile
2. Locates an EC2 instance by its **Name tag**.
3. Finds the RDS instance endpoint. 
4. Starts an **SSM port forwarding session** between your local machine and the RDS instance. 
5. Securely fetches database credentials from **AWS Secrets Manager**. 
6. Opens a MySQL session either via local `mysql` or Docker fallback.

This is ideal for securely connecting to private RDS databases in non-public VPCs (e.g., Dev/Stage/Prod environments).

---

## 🚀 Usage

```bash
export AWS_PROFILE=<< ENTER THE PROFILE FOR CareActivation >>
./ssm-rds-auto-connect.sh [LOCAL_PORT]
```

* **LOCAL_PORT** (optional): Local port to bind for forwarding (defaults to `3306`).

Example:

```bash
./ssm-rds-auto-connect.sh
```

or

```bash
./ssm-rds-auto-connect.sh 13306
```

---

## ⚙️ Configuration

Update the following variables inside the script to match your environment:

```bash
EC2_TAG_NAME="care-activation-dev-ssm-ec2"          # EC2 instance Name tag
RDS_INSTANCE_ID="care-activation-dev-mysql-db"      # RDS instance identifier
SECRET_ID="dev/care-activation-mysql-credentials"   # AWS Secrets Manager secret
```

### Secret Format (in AWS Secrets Manager)

The secret should be stored as JSON:

```json
{
  "db_username": "admin",
  "db_password": "supersecretpassword"
}
```

---

## 🔐 Prerequisites

Ensure you have the following tools installed and configured:

| Dependency | Description                                                      | Install                                                                                          |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `aws` CLI  | Required for SSM, EC2, RDS, Secrets Manager commands             | [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| `jq`       | JSON parsing utility                                             | `sudo dnf install jq` or `brew install jq`                                                       |
| `mysql`    | MySQL client (optional, script will use Docker if not installed) | `sudo dnf install mysql` or `brew install mysql`                                                 |
| `Docker`   | Used as fallback client                                          | [Install Docker](https://docs.docker.com/get-docker/)                                            |

---

## 🧰 How It Works

| Step | Action                                                  |
| ---- | ------------------------------------------------------- |
| 1️⃣  | Finds the EC2 instance by tag name                      |
| 2️⃣  | Fetches the RDS endpoint                                |
| 3️⃣  | Starts an SSM port forwarding session to the RDS host   |
| 4️⃣  | Waits for the local port to become available            |
| 5️⃣  | Retrieves database credentials from AWS Secrets Manager |
| 6️⃣  | Connects using local MySQL client or Docker MySQL image |
| 7️⃣  | Cleans up the SSM session on exit                       |

---

## 🧹 Cleanup

The script automatically terminates the SSM session when you exit (`Ctrl + C`).

---

## 🧪 Example Output

```text
Found EC2 instance: i-0123456789abcdef0
Found RDS endpoint: care-activation-dev-db.xxxxxx.us-east-1.rds.amazonaws.com
Starting SSM port forwarding session...
Waiting for localhost:3306 to be ready...
Connecting with local mysql client...
```

---

## 🧭 Notes

* Ensure your IAM user/role has the following AWS permissions:

    * `ssm:StartSession`
    * `ssm:TerminateSession`
    * `ec2:DescribeInstances`
    * `rds:DescribeDBInstances`
    * `secretsmanager:GetSecretValue`
* Works best in private VPC environments.
* Does not expose credentials in logs.

---
