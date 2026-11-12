#!/bin/sh
# Publish the ChargeUI marketing site to AWS (S3 + CloudFront, account "New Frontiers").
# Usage: ./deploy.sh        (run from this folder after signing in: aws login --profile chargeui-client --region ap-southeast-2)
set -e
cd "$(dirname "$0")"
export AWS_PROFILE=chargeui-client
BUCKET=chargeui-website-161987605364
DIST=E21IVKMITZCL74

aws sts get-caller-identity --query Account --output text | grep -qx 161987605364 \
  || { echo "Not signed in to the New Frontiers account (161987605364). Run: aws login --profile chargeui-client --region ap-southeast-2"; exit 1; }

EXCLUDES="--exclude .git/* --exclude .gitignore --exclude .nojekyll --exclude *.DS_Store --exclude *.md --exclude deploy.sh"
# Images, styles and scripts: cached for a day (links carry ?v= numbers, so bump those when a file changes).
aws s3 sync . "s3://$BUCKET/" $EXCLUDES --exclude "*.html" --cache-control "public, max-age=86400" --delete --only-show-errors
# Pages: cached for 5 minutes.
aws s3 sync . "s3://$BUCKET/" $EXCLUDES --exclude "*" --include "*.html" --cache-control "public, max-age=300" --content-type "text/html; charset=utf-8" --only-show-errors
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --query 'Invalidation.Status' --output text
echo "Published: https://www.chargeui.in"
