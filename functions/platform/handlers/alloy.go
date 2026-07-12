package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

const defaultAlloyChartVersion = "1.0.3"

const alloyRiverTemplate = `prometheus.remote_write "default" {
  endpoint {
    url = "%s"
  }
}

discovery.kubernetes "pods" {
  role = "pod"
}

prometheus.scrape "pods" {
  targets    = discovery.kubernetes.pods.targets
  forward_to = [prometheus.remote_write.default.receiver]
}
`

// Alloy handles kind=AlloyInstance. It emits a provider-helm Release installing
// grafana/alloy (DaemonSet) with a remote_write pipeline to spec.remoteWriteEndpoint.
//
// The endpoint is either set directly on the XR or injected by the parent
// ObservabilityStack handler from the stack's metrics backend.
func Alloy(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()

	res := &platform.Result{Desired: platform.Desired{}}

	endpoint := platform.SpecString(oxr, "remoteWriteEndpoint")
	if endpoint == "" {
		res.Warnings = append(res.Warnings,
			"spec.remoteWriteEndpoint is unset; Alloy will run without a remote_write target until it is provided")
		endpoint = "http://127.0.0.1:9090/api/v1/write"
	}

	wired := map[string]any{
		"fullnameOverride": name + "-alloy",
		"alloy": map[string]any{
			"configMap": map[string]any{
				"content": fmt.Sprintf(alloyRiverTemplate, endpoint),
			},
		},
	}

	merged := deepMerge(userValues(oxr), wired)
	rel := helmRelease(oxr, name+"-alloy", "alloy", grafanaChartsRepo,
		chartVersion(oxr, "ALLOY_CHART_VERSION", defaultAlloyChartVersion), merged)
	res.Desired[resource.Name("alloy")] = &resource.DesiredComposed{Resource: rel}
	res.Status = map[string]any{"phase": "Provisioning"}
	return res, nil
}
