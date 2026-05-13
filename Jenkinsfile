pipeline {
  agent any

  environment {
    TF_IN_AUTOMATION = 'true'
    TF_INPUT = '0'

    // Workaround for Docker Desktop/Windows mounts that may be 'noexec'
    // so Terraform provider binaries can be executed.
    TF_DATA_DIR = "/tmp/tfdata-${BUILD_NUMBER}"
    TF_PLUGIN_CACHE_DIR = "/tmp/tfplugin-cache"

    // Target app under test
    TF_VAR_base_url = 'http://pepi-semen.inaai.ai:5173'

    // Where Terraform should connect for Docker API
    TF_VAR_docker_host = 'unix:///var/run/docker.sock'

    // Cypress runner image (matches repo devDependency Cypress major)
    TF_VAR_runner_image = 'cypress/included:15.15.0'

    // Download source as tarball inside the runner (no git bind-mount needed)
    TF_VAR_repo_archive_url = 'https://github.com/rahelnatasya/semen-cypress/archive/refs/heads/main.tar.gz'

    // Optional: set to a specific spec, or keep empty to run all specs
    TF_VAR_spec = ''
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Terraform Init') {
      steps {
        dir('terraform') {
          sh 'mkdir -p "$TF_DATA_DIR" "$TF_PLUGIN_CACHE_DIR"'
          sh 'terraform --version'
          sh 'terraform init -upgrade'
        }
      }
    }

    stage('Run Cypress (Terraform -> Docker)') {
      steps {
        dir('terraform') {
          sh 'terraform apply -auto-approve -var="run_id=${BUILD_NUMBER}"'
        }
      }
    }
  }

  post {
    always {
      dir('terraform') {
        // Ensure we clean up the runner container even if Cypress fails
        sh 'terraform destroy -auto-approve -var="run_id=${BUILD_NUMBER}" || true'
      }
    }
  }
}
