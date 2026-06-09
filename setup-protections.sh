#!/usr/bin/env bash
# Setup branch protections for the main branch.
# Run manually: bash setup-protections.sh
#
# Requires: gh CLI authenticated with admin permissions.

set -euo pipefail

OWNER="qms-product"
REPO="secretariat-medical"
BRANCH="main"

echo "Setting branch protection rules for $OWNER/$REPO ($BRANCH)..."

gh api \
  --method PUT \
  "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["ci"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo "Branch protections configured successfully."
