terraform {
  required_version = "~> 1.16.0"
  required_providers {
    github = { source = "integrations/github", version = "6.13.0" }
  }
}

provider "github" { owner = var.github_owner }
