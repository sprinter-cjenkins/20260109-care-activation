#!/bin/zsh
set -e

name=""
IAM_FILE="${HOME}/.aws/care-activation/iam"
CREDENTIALS_FILE="${HOME}/.aws/care-activation/credentials"

# Hard-coded for care-activation account
ACCOUNT_ID="417107812602"

# Auto detect IAM name
if [ -f "$IAM_FILE" ];
then
  name=`cat ${IAM_FILE}`
fi

if [ "$name" != "" ];
then
  # name is set in IAM_FILE
  echo "Username from $IAM_FILE: $name"
else

  possible_name=""

  if command -v whoami &> /dev/null
  then
    possible_name="$(whoami)"
  fi

  read "name?IAM profile name [$possible_name]: "

  if [ "$name" = "" ]
  then
    name="$possible_name"
  fi
fi

if [ "$name" = "" ]
then
  echo "Username is required!"
  exit
fi

if [ ! -z $1 ]; then
  re='^[0-9]+$'
  if ! [[ $1 =~ $re ]]; then
    echo "error: Not a number" >&2;
  else
    if [ ${#1} -ne 6 ]; then
      echo "error: Not in range" >&2;
    else
      code=$1
    fi
  fi
fi

if [ -z $code ]; then
  read "code?MFA 6 digit code: "
else
  echo "MFA 6 digit code: $code";
fi

echo "Using care-activation account (417107812602)"
echo "Reading from: $CREDENTIALS_FILE"

echo "Using username: $name"
echo "MFA Serial: arn:aws:iam::$ACCOUNT_ID:mfa/$name"

# Export custom credentials file location for this command
export AWS_SHARED_CREDENTIALS_FILE="$CREDENTIALS_FILE"

echo "Verifying credentials in $CREDENTIALS_FILE..."
aws sts get-caller-identity --profile default 2>&1 || {
  echo "ERROR: Could not read credentials from $CREDENTIALS_FILE"
  echo "Make sure you have the correct credentials set up"
  exit 1
}
echo ""

JSON=$(aws sts get-session-token --serial-number arn:aws:iam::$ACCOUNT_ID:mfa/$name --token-code $code --profile default --duration-seconds 129600)

ACCESS=$(echo $JSON | grep -o '"AccessKeyId": *"[^"]*' | grep -o '[^"]*$')
SECRET=$(echo $JSON | grep -o '"SecretAccessKey": *"[^"]*' | grep -o '[^"]*$')
TOKEN=$(echo $JSON | grep -o '"SessionToken": *"[^"]*' | grep -o '[^"]*$')

# if we dont have mfa in the credentials file, add it...
if grep -q "\[default\]" "$CREDENTIALS_FILE" 2>/dev/null; then
  sed -i '' '/\[default\]/{N;N;N;N;d;}' "$CREDENTIALS_FILE"
fi

mkdir -p ~/.aws/care-activation
cat <<EOT >> "$CREDENTIALS_FILE"
[default]
aws_access_key_id=$ACCESS
aws_secret_access_key=$SECRET
aws_session_token=$TOKEN
EOT

echo "Token successfully updated in $CREDENTIALS_FILE!"