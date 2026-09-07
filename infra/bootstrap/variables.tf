variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "name" {
  type    = string
  default = "music-companion"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique private Terraform state bucket name."
}
