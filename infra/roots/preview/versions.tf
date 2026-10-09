terraform {
  required_version = "= 1.16.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 5.27.0"
    }
  }
}
