{{/*
hiroba-app.statefulset — application StatefulSet.
*/}}
{{- define "hiroba-app.statefulset" -}}
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ include "hiroba-app.fullname" . }}
  labels:
    {{- include "hiroba-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  serviceName: {{ default (include "hiroba-app.fullname" .) .Values.statefulset.serviceName }}
  {{- with .Values.statefulset.podManagementPolicy }}
  podManagementPolicy: {{ . }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "hiroba-app.selectorLabels" . | nindent 6 }}
  {{- with .Values.statefulset.updateStrategy }}
  updateStrategy:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "hiroba-app.labels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "hiroba-app.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          {{- with .Values.args }}
          args:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          {{- with .Values.livenessProbe }}
          livenessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.readinessProbe }}
          readinessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- with .Values.env }}
          env:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.envFrom }}
          envFrom:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- if or .Values.config.enabled .Values.persistence.claims .Values.extraVolumeMounts .Values.statefulset.volumeClaimTemplates }}
          volumeMounts:
            {{- if .Values.config.enabled }}
            {{- range $i, $cfg := .Values.config.configs }}
            - name: config-{{ $i }}
              mountPath: {{ $cfg.mountPath }}
              subPath: {{ $cfg.subPath }}
              readOnly: {{ $cfg.readOnly }}
            {{- end }}
            {{- end }}
            {{- range .Values.persistence.claims }}
            - name: persistence-{{ .name }}
              mountPath: {{ .mountPath }}
            {{- end }}
            {{- with .Values.extraVolumeMounts }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
            {{- if .Values.statefulset.volumeClaimTemplates }}
            {{- range $i, $vct := .Values.statefulset.volumeClaimTemplates }}
            - name: {{ $vct.metadata.name }}
              mountPath: {{ $vct.mountPath }}
            {{- end }}
            {{- end }}
          {{- end }}
      {{- if or .Values.config.enabled .Values.persistence.claims .Values.extraVolumes }}
      volumes:
        {{- if .Values.config.enabled }}
        {{- range $i, $cfg := .Values.config.configs }}
        - name: config-{{ $i }}
          configMap:
            name: {{ default (printf "%s-app-config" (include "hiroba-app.fullname" $)) $cfg.configMapName }}
        {{- end }}
        {{- end }}
        {{- range .Values.persistence.claims }}
        - name: persistence-{{ .name }}
          persistentVolumeClaim:
            {{- if .existingClaim }}
            claimName: {{ .existingClaim }}
            {{- else }}
            claimName: {{ include "hiroba-app.fullname" $ }}-{{ .name }}
            {{- end }}
        {{- end }}
        {{- with .Values.extraVolumes }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
  {{- with .Values.statefulset.volumeClaimTemplates }}
  volumeClaimTemplates:
    {{- range . }}
    - metadata:
        name: {{ .metadata.name }}
        {{- with .metadata.annotations }}
        annotations:
          {{- toYaml . | nindent 10 }}
        {{- end }}
      spec:
        {{- toYaml .spec | nindent 8 }}
    {{- end }}
  {{- end }}
{{- end }}
