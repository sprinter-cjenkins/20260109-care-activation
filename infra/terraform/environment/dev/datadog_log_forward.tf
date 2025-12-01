locals {
  tags = {
    name        = "datadog-log-forward"
    Environment = terraform.workspace
  }
}
module "log_forwarder" {
  source = "../../modules/log_forwarder"

  kms_alias             = aws_kms_alias.datadog.name
  dd_api_key_secret_arn = data.aws_secretsmanager_secret.datadog_api_key.arn

  tags = local.tags
}

resource "random_pet" "this" {
  length = 2
}

resource "aws_kms_key" "datadog" {
  description         = "Datadog KMS CMK"
  enable_key_rotation = true
  policy              = data.aws_iam_policy_document.datadog_cmk.json

  tags = local.tags
}

data "aws_iam_policy_document" "datadog_cmk" {
  statement {
    sid = "CMKOwnerPolicy"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }
}

resource "aws_kms_alias" "datadog" {
  name          = "alias/datadog/${random_pet.this.id}"
  target_key_id = aws_kms_key.datadog.key_id
}
