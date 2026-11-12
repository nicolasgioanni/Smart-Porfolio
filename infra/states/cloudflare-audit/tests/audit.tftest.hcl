mock_provider "cloudflare" {}

variables {
  cloudflare_account_id   = "0123456789abcdef0123456789abcdef"
  collector_bundle_path   = abspath("tests/fixtures/release/collector/index.js")
  collector_bundle_sha256 = "8dbdc285844e1ec2f00739c326c5da496e56f9cb4d0b1bbd5aa980c42ee3ee04"
}

run "audit_delivery_and_retention_are_hardened" {
  command = plan

  assert {
    condition     = cloudflare_queue.audit_events.settings.message_retention_period == 1209600 && cloudflare_queue.audit_events_dlq.settings.message_retention_period == 1209600 && cloudflare_queue.audit_events.settings.delivery_delay == 0 && cloudflare_queue.audit_events_dlq.settings.delivery_delay == 0
    error_message = "The audit queue and its DLQ must retain messages for fourteen days without delay."
  }

  assert {
    condition     = cloudflare_r2_bucket_lock.application_audit.bucket_name == cloudflare_r2_bucket.application_audit.name && cloudflare_r2_bucket_lock.application_audit.rules[0].id == "retain-application-audit-90-days" && cloudflare_r2_bucket_lock.application_audit.rules[0].enabled && cloudflare_r2_bucket_lock.application_audit.rules[0].condition.type == "Age" && cloudflare_r2_bucket_lock.application_audit.rules[0].condition.max_age_seconds == 7776000 && cloudflare_r2_bucket_lock.release_control.bucket_name == cloudflare_r2_bucket.release_control.name && cloudflare_r2_bucket_lock.release_control.rules[0].id == "retain-release-control-365-days" && cloudflare_r2_bucket_lock.release_control.rules[0].enabled && cloudflare_r2_bucket_lock.release_control.rules[0].condition.type == "Age" && cloudflare_r2_bucket_lock.release_control.rules[0].condition.max_age_seconds == 31536000
    error_message = "Application and release-control audit records require enabled 90-day and 365-day locks."
  }

  assert {
    condition     = cloudflare_r2_bucket.application_audit.name == "smart-portfolio-application-audit" && cloudflare_r2_bucket.release_control.name == "smart-portfolio-release-control"
    error_message = "Audit buckets must remain dedicated private storage resources; public exposure resources are not declared in this state."
  }

  assert {
    condition     = cloudflare_r2_bucket_lifecycle.application_audit.rules[0].id == "delete-application-audit-after-90-days" && cloudflare_r2_bucket_lifecycle.application_audit.rules[0].conditions.prefix == "" && cloudflare_r2_bucket_lifecycle.application_audit.rules[0].delete_objects_transition.condition.type == "Age" && cloudflare_r2_bucket_lifecycle.application_audit.rules[0].delete_objects_transition.condition.max_age == 7776000 && cloudflare_r2_bucket_lifecycle.release_control.rules[0].id == "delete-release-control-after-365-days" && cloudflare_r2_bucket_lifecycle.release_control.rules[0].conditions.prefix == "" && cloudflare_r2_bucket_lifecycle.release_control.rules[0].delete_objects_transition.condition.type == "Age" && cloudflare_r2_bucket_lifecycle.release_control.rules[0].delete_objects_transition.condition.max_age == 31536000
    error_message = "Audit buckets must schedule full-bucket lifecycle deletion after their reviewed retention periods."
  }

  assert {
    condition     = !cloudflare_r2_managed_domain.application_audit.enabled && !cloudflare_r2_managed_domain.release_control.enabled && cloudflare_workers_script.audit_collector.script_name == "smart-portfolio-audit-collector" && cloudflare_workers_script.audit_collector.main_module == "index.js" && cloudflare_workers_script.audit_collector.bindings[0].name == "APP_AUDIT_BUCKET" && cloudflare_workers_script.audit_collector.bindings[0].type == "r2_bucket" && cloudflare_workers_script.audit_collector.bindings[0].bucket_name == cloudflare_r2_bucket.application_audit.name && !cloudflare_workers_script_subdomain.audit_collector.enabled && !cloudflare_workers_script_subdomain.audit_collector.previews_enabled
    error_message = "The collector has only the private application-audit R2 binding and no public Worker, preview, or bucket URL."
  }

  assert {
    condition     = cloudflare_queue_consumer.audit_collector.type == "worker" && cloudflare_queue_consumer.audit_collector.script_name == "smart-portfolio-audit-collector" && cloudflare_queue_consumer.audit_collector.dead_letter_queue == cloudflare_queue.audit_events_dlq.queue_name && cloudflare_queue_consumer.audit_collector.settings.batch_size == 10 && cloudflare_queue_consumer.audit_collector.settings.max_wait_time_ms == 5000 && cloudflare_queue_consumer.audit_collector.settings.max_retries == 5
    error_message = "The collector must consume only the primary audit queue with the reviewed DLQ and retry limits."
  }
}
