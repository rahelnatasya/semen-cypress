terraform {
  required_version = ">= 1.3.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

variable "docker_host" {
  description = "Docker daemon host for the Terraform Docker provider."
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "run_id" {
  description = "Unique ID per Jenkins build (e.g. BUILD_NUMBER) so container names don't collide."
  type        = string
}

variable "base_url" {
  description = "Target app base URL for Cypress."
  type        = string
}

variable "repo_archive_url" {
  description = "URL to a tar.gz archive of the Cypress repo (used so the runner doesn't need git)."
  type        = string
  default     = "https://github.com/rahelnatasya/semen-cypress/archive/refs/heads/main.tar.gz"
}

variable "runner_image" {
  description = "Docker image that contains Cypress + Node (recommended: cypress/included:<version>)."
  type        = string
  default     = "cypress/included:15.15.0"
}

variable "spec" {
  description = "Optional Cypress spec glob/path. Leave empty to run all specs."
  type        = string
  default     = ""
}

provider "docker" {
  host = var.docker_host
}

resource "docker_image" "runner" {
  name         = var.runner_image
  keep_locally = true
}

locals {
  container_name = "cypress-runner-${var.run_id}"

  runner_script = <<-BASH
    set -eo pipefail

    echo "Downloading test repo: $REPO_ARCHIVE_URL"
    rm -rf /e2e
    mkdir -p /e2e
    cd /e2e

    curl -fsSL "$REPO_ARCHIVE_URL" | tar -xz --strip-components=1

    echo "Installing npm deps..."
    npm ci

    SPEC_ARG=""
    if [ -n "$CYPRESS_SPEC" ]; then
      SPEC_ARG="--spec $CYPRESS_SPEC"
    fi

    echo "Running Cypress against baseUrl=$CYPRESS_baseUrl"
    npx cypress run --config baseUrl="$CYPRESS_baseUrl" $SPEC_ARG
  BASH
}

resource "docker_container" "cypress_runner" {
  name  = local.container_name
  image = docker_image.runner.image_id

  must_run = false
  attach   = true
  logs     = true

  entrypoint = ["bash", "-lc"]
  command    = [local.runner_script]

  env = [
    "CI=1",
    "CYPRESS_baseUrl=${var.base_url}",
    "REPO_ARCHIVE_URL=${var.repo_archive_url}",
    "CYPRESS_SPEC=${var.spec}",
  ]

  shm_size = 1024

  lifecycle {
    postcondition {
      condition     = self.exit_code == 0
      error_message = "Cypress failed (exit_code=${self.exit_code})."
    }
  }
}

output "runner_container_name" {
  value = docker_container.cypress_runner.name
}

output "runner_exit_code" {
  value = docker_container.cypress_runner.exit_code
}
