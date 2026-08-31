{{- define "orion.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "orion.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "orion.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "orion.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Every image shares one tag so an install can never mix an api from one release
with a nexrad from another.
*/}}
{{- define "orion.image" -}}
{{- $tag := default $.root.Chart.AppVersion $.root.Values.image.tag -}}
{{- printf "%s/%s/orion-%s:%s" $.root.Values.image.registry $.root.Values.image.repository $.name $tag -}}
{{- end -}}

{{- define "orion.frameVolumeClaim" -}}
{{- if .Values.persistence.existingClaim -}}
{{- .Values.persistence.existingClaim -}}
{{- else -}}
{{- printf "%s-frames" (include "orion.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Resource allocation reaches the process through the Downward API rather than
cgroup introspection: it is explicit, it survives a cgroup layout change, and
requests.cpu is meaningful whether or not a CPU limit is set.

limits.cpu is only injected when a limit actually exists -- resourceFieldRef
falls back to the node's allocatable CPU for an unset limit, which is the same
"pool sized to the whole node" bug that sizing from os.cpu_count() caused.
*/}}
{{- define "orion.cpuEnv" -}}
- name: ORION_CPU_REQUEST
  valueFrom:
    resourceFieldRef:
      containerName: {{ .name }}
      resource: requests.cpu
      divisor: "1"
{{- if dig "limits" "cpu" "" .resources }}
- name: ORION_CPU_LIMIT
  valueFrom:
    resourceFieldRef:
      containerName: {{ .name }}
      resource: limits.cpu
      divisor: "1"
{{- end }}
{{- end -}}
