variable "instance_connect_cidrs" {
  description = "How to connect to the UI via AWS UI"
}

variable "port" {
  description = "API port that is open for external access"
  default     = ""
}

variable "ingress_security_groups" {
    description = "Security group to allow ingress from"
    type = list(object({
        id = string
    }))
}
