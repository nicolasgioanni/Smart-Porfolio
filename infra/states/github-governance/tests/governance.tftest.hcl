mock_provider "github" {}

variables {
  github_owner = "nicolasgioanni"
  repository   = "Smart-Porfolio"
}

run "single_existing_permanent_branch_ruleset" {
  command = plan

  assert {
    condition     = github_repository_ruleset.permanent_branches.name == "protect-permanent-branches" && github_repository_ruleset.permanent_branches.enforcement == "active"
    error_message = "The existing permanent-branch ruleset must remain active."
  }

  assert {
    condition     = toset(github_repository_ruleset.permanent_branches.conditions[0].ref_name[0].include) == toset(["refs/heads/main", "refs/heads/develop"]) && length(github_repository_ruleset.permanent_branches.conditions[0].ref_name[0].exclude) == 0 && github_repository_ruleset.permanent_branches.rules[0].deletion && github_repository_ruleset.permanent_branches.rules[0].non_fast_forward
    error_message = "The single ruleset must protect exactly main and develop from deletion and non-fast-forward updates."
  }

  assert {
    condition     = length(github_repository_ruleset.permanent_branches.bypass_actors) == 0
    error_message = "The permanent-branch ruleset cannot add a bypass actor."
  }
}
