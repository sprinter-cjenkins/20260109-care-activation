#!/bin/zsh
set -e

# ---------------------------
# Config
# ---------------------------
CREDENTIALS_FILE="${HOME}/.aws/credentials"
IAM_FILE="${HOME}/.aws/care-activation-iam"
BASE_PROFILE="care-activation-base"   # static IAM credentials
SESSION_PROFILE="care-activation"     # temporary MFA session
ACCOUNT_ID="417107812602"

# Auto detect IAM name
if [ -f "$IAM_FILE" ];
then
  name=`cat ${IAM_FILE}`
  echo "Username from $IAM_FILE: $name"
fi

# If we don't find the name there, try `username + -ca` because thats what mine is
if [ "$name" = "" ] && command -v whoami &> /dev/null;
then

  name="$(whoami)-ca"  
  echo "username autofilled to: $name"
  echo "if this doesn't work, set your name in ~/.aws/care-activation-iam"
fi

if [ "$name" = "" ];
then
  echo "No username found in $IAM_FILE or whoami"
  exit 1
fi

# ---------------------------
# MFA code
# ---------------------------
if [[ -n $1 ]]; then
    if [[ ! $1 =~ ^[0-9]{6}$ ]]; then
        echo "ERROR: MFA code must be 6 digits"
        exit 1
    fi
    MFA_CODE=$1
else
    read "MFA_CODE?Enter 6-digit MFA code: "
fi

# ---------------------------
# Ensure credentials file exists
# ---------------------------
mkdir -p "$(dirname "$CREDENTIALS_FILE")"
touch "$CREDENTIALS_FILE"

export AWS_SHARED_CREDENTIALS_FILE="$CREDENTIALS_FILE"

# ---------------------------
# Get temporary session token
# ---------------------------
JSON=$(aws sts get-session-token \
    --serial-number "arn:aws:iam::$ACCOUNT_ID:mfa/$name" \
    --token-code "$MFA_CODE" \
    --profile "$BASE_PROFILE" \
    --duration-seconds 129600)

ACCESS=$(echo $JSON | grep -o '"AccessKeyId": *"[^"]*' | grep -o '[^"]*$')
SECRET=$(echo $JSON | grep -o '"SecretAccessKey": *"[^"]*' | grep -o '[^"]*$')
TOKEN=$(echo $JSON | grep -o '"SessionToken": *"[^"]*' | grep -o '[^"]*$')

# ---------------------------
# Update credentials file with care-activation session profile
# ---------------------------
if grep -q "\[$SESSION_PROFILE\]" "$CREDENTIALS_FILE" 2>/dev/null; then
    sed -i '' "/\[$SESSION_PROFILE\]/,/^$/d" "$CREDENTIALS_FILE"
fi

cat <<EOT >> "$CREDENTIALS_FILE"
[$SESSION_PROFILE]
aws_access_key_id=$ACCESS
aws_secret_access_key=$SECRET
aws_session_token=$TOKEN
EOT

# ---------------------------
# Feedback
# ---------------------------
echo "✅ MFA session updated for profile [$SESSION_PROFILE] in $CREDENTIALS_FILE"
echo "Run: export AWS_PROFILE=$SESSION_PROFILE"
