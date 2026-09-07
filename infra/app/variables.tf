variable "region" {
  type    = string
  default = "ap-northeast-1"
}
variable "name" {
  type    = string
  default = "music-companion"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,35}$", var.name))
    error_message = "Use 3-36 lowercase letters, digits, or hyphens, starting with a letter."
  }
}
variable "music_table_name" {
  type    = string
  default = "MusicUrls"
}
variable "ecr_repository_name" { type = string }
variable "agent_image_digest" {
  type        = string
  description = "Immutable sha256 digest of the ARM64 agent image."
  validation {
    condition     = can(regex("^sha256:[a-f0-9]{64}$", var.agent_image_digest))
    error_message = "Provide the pushed image's sha256 digest."
  }
}
variable "bedrock_model_id" {
  type        = string
  description = "Available Bedrock Converse model or inference profile supporting toolChoice.any."
}
variable "bedrock_model_arns" {
  type        = list(string)
  description = "Exact model/profile ARNs, including destination models for cross-region inference."
  validation {
    condition     = length(var.bedrock_model_arns) > 0 && alltrue([for arn in var.bedrock_model_arns : startswith(arn, "arn:aws:bedrock:") && !strcontains(arn, "*")])
    error_message = "Provide explicit Bedrock ARNs without wildcards."
  }
}
variable "amplify_compute_role_name" {
  type        = string
  description = "Existing Amplify SSR compute role; not the build service role."
}
variable "musicbrainz_user_agent" {
  type        = string
  description = "Application/version and a contact URL as required by MusicBrainz."
}
