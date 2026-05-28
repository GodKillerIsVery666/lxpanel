{{- define "lxpanel.fullname" -}}
{{- printf "%s-%s" .Release.Name "lxpanel" | trunc 63 | trimSuffix "-" -}}
{{- end -}}
