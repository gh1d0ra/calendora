# Calendora's Cloudflare resources as code.
#
# Terraform owns the stateful resources: the D1 database and the job queues. Wrangler owns the Worker's code
# and bindings (wrangler.toml), the Durable Object class (created by its [[migrations]]) and the queue consumer,
# because Workers Builds deploys them on every push. The existing database is adopted with an import block,
# so `terraform apply` never recreates it.
#
#   cd infra
#   cp terraform.tfvars.example terraform.tfvars   # your account id
#   export CLOUDFLARE_API_TOKEN=…                    # D1 edit, Queues edit
#   terraform init && terraform plan

terraform {
  required_version = ">= 1.6"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {} # reads CLOUDFLARE_API_TOKEN

variable "account_id" {
  description = "Cloudflare account id (dashboard → Workers & Pages → Account details)"
  type        = string
}

# Families, accounts, the shared boards, saved calendar copies and recipe photos. Never destroyed by Terraform.
resource "cloudflare_d1_database" "main" {
  account_id = var.account_id
  name       = "calendora"
  read_replication = {
    mode = "disabled"
  }
  lifecycle {
    prevent_destroy = true
  }
}

import {
  to = cloudflare_d1_database.main
  id = "${var.account_id}/f4154ecc-db4f-4706-9c8d-b5691d761d6a"
}

# Background jobs (AnyList sync, re-fetching calendars whose source is down); see src/worker.js → runJob.
resource "cloudflare_queue" "jobs" {
  account_id = var.account_id
  queue_name = "calendora-jobs"
}

# Messages that failed every retry. Nothing consumes it: inspect it in the dashboard, then fix and replay.
resource "cloudflare_queue" "jobs_dlq" {
  account_id = var.account_id
  queue_name = "calendora-jobs-dlq" # default retention: longer periods need Workers Paid
}

# Both queues were first created with `wrangler queues create`; adopt them.
import {
  to = cloudflare_queue.jobs
  id = "${var.account_id}/1ab7bc2706534ed8a81bf47252ac1f27"
}

import {
  to = cloudflare_queue.jobs_dlq
  id = "${var.account_id}/3f3f3931be9942a0a34c1b1d252516cf"
}

output "d1_id" {
  description = "database_id for [[d1_databases]] in wrangler.toml"
  value       = cloudflare_d1_database.main.id
}

output "queues" {
  value = [cloudflare_queue.jobs.queue_name, cloudflare_queue.jobs_dlq.queue_name]
}
