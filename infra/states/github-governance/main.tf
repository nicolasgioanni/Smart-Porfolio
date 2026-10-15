terraform {
  backend "remote" {}
}

variable "github_owner" { type = string }
variable "repository" { type = string }

# This is the one existing permanent-branch ruleset. It is intentionally
# limited to integrity protections; the classic main pull-request policy
# remains external GitHub governance and is not duplicated here.
resource "github_repository_ruleset" "permanent_branches" {
  repository  = var.repository
  name        = "protect-permanent-branches"
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/main", "refs/heads/develop"]
      exclude = []
    }
  }

  rules {
    deletion         = true
    non_fast_forward = true
  }

  lifecycle {
    prevent_destroy = true
  }
}
