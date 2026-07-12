package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

const defaultPrometheusChartVersion = "72.6.2"

var prometheusRetentionByProfile = map[string]int64{
	"development": 3,
	"staging":     7,
	"production":  30,
}

// Prometheus handles kind=PrometheusInstance. It emits a provider-helm Release
// installing kube-prometheus-stack with a deterministic service name, and publishes
// the in-cluster query/remote-write endpoints.
func Prometheus(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	retention, found := platform.SpecInt64(oxr, "retentionDays")
	if !found || retention < 1 {
		retention = prometheusRetentionByProfile[platform.Profile(oxr)]
		if retention == 0 {
			retention = 3
		}
	}

	fullname := name + "-prom"
	service := fullname + "-prometheus"

	wired := map[string]any{
		"fullnameOverride": fullname,
		"prometheus": map[string]any{
			"prometheusSpec": map[string]any{
				"retention": fmt.Sprintf("%dd", retention),
			},
		},
	}

	// defaults < user values < platform wiring
	merged := deepMerge(userValues(oxr), wired)
	rel := helmRelease(oxr, name+"-prometheus", "kube-prometheus-stack", prometheusChartsRepo,
		chartVersion(oxr, "PROMETHEUS_CHART_VERSION", defaultPrometheusChartVersion), merged)

	endpoint := fmt.Sprintf("http://%s.%s.svc:9090", service, ns)
	return &platform.Result{
		Desired: platform.Desired{
			resource.Name("prometheus"): {Resource: rel},
		},
		Status: map[string]any{
			"phase":    "Provisioning",
			"endpoint": endpoint,
		},
		ConnectionDetails: resource.ConnectionDetails{
			"url":             []byte(endpoint),
			"remoteWriteUrl":  []byte(endpoint + "/api/v1/write"),
			"alertmanagerUrl": []byte(fmt.Sprintf("http://%s-alertmanager.%s.svc:9093", fullname, ns)),
		},
	}, nil
}
