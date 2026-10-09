provider "github" {
  owner = var.github_owner
}

# Existing repository governance must be imported with a separately reviewed
# exact ID before a no-op adoption plan. No bypass actor is managed here.
resource "github_repository_ruleset" "permanent_branches" {
  repository  = var.github_repository
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
