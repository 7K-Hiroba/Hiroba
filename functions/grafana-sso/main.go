package main

import (
	"context"
	"encoding/json"

	"github.com/crossplane/function-sdk-go/errors"
	"github.com/crossplane/function-sdk-go/logging"
	"github.com/crossplane/function-sdk-go/request"
	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/response"
	fnv1 "github.com/crossplane/function-sdk-go/proto/v1"
)

// Function implements the Crossplane Composition Function for Grafana SSO logic.
type Function struct {
	fnv1.UnimplementedFunctionRunnerServiceServer

	log logging.Logger
}

// RunFunction generates composed resources based on the observed XR spec.
func (f *Function) RunFunction(_ context.Context, req *fnv1.RunFunctionRequest) (*fnv1.RunFunctionResponse, error) {
	log := f.log.WithValues("tag", req.GetMeta().GetTag())
	log.Info("Running Grafana SSO function")

	rsp := response.To(req, response.DefaultTTL)

	observed, err := request.GetObservedCompositeResource(req)
	if err != nil {
		return response.Fatal(rsp, errors.Wrap(err, "cannot get observed composite resource"))
	}

	// Read the SSO feature toggle from the XR spec.
	enabled, err := observed.GetBool("spec.features.sso.enabled")
	if err != nil {
		log.Debug("SSO feature not specified, defaulting to false")
		enabled = false
	}

	// Generate the base Grafana resource (always desired).
	if err := generateGrafana(req, rsp); err != nil {
		return response.Fatal(rsp, errors.Wrap(err, "cannot generate Grafana resource"))
	}

	if enabled {
		if err := generateOAuth2Proxy(req, rsp); err != nil {
			return response.Fatal(rsp, errors.Wrap(err, "cannot generate OAuth2-Proxy resource"))
		}
		if err := generateExternalSecret(req, rsp); err != nil {
			return response.Fatal(rsp, errors.Wrap(err, "cannot generate ExternalSecret resource"))
		}
	}

	return rsp, nil
}

func generateGrafana(req *fnv1.RunFunctionRequest, rsp *fnv1.RunFunctionResponse) error {
	observed, _ := request.GetObservedCompositeResource(req)

	grafana := &resource.DesiredComposed{
		Resource: resource.NewDesiredComposed(),
	}
	grafana.Resource.SetAPIVersion("grafana.integreatly.org/v1beta1")
	grafana.Resource.SetKind("Grafana")

	// Apply patches from XR spec.
	profile, _ := observed.GetString("spec.profile")
	domain, _ := observed.GetString("spec.domain")

	replicas := int64(1)
	if profile == "production" {
		replicas = 2
	}

	config := map[string]any{
		"auth": map[string]any{
			"disable_login_form": "false",
			"generic_oauth": map[string]any{
				"enabled": "false",
			},
		},
		"server": map[string]any{
			"root_url": "https://" + domain,
		},
	}

	if err := grafana.Resource.SetValue("spec.config", config); err != nil {
		return err
	}
	if err := grafana.Resource.SetValue("spec.deployment.spec.replicas", replicas); err != nil {
		return err
	}

	if err := response.SetDesiredComposedResource(rsp, grafana); err != nil {
		return err
	}
	return nil
}

func generateOAuth2Proxy(req *fnv1.RunFunctionRequest, rsp *fnv1.RunFunctionResponse) error {
	proxy := &resource.DesiredComposed{
		Resource: resource.NewDesiredComposed(),
	}
	proxy.Resource.SetAPIVersion("apps/v1")
	proxy.Resource.SetKind("Deployment")

	deployment := map[string]any{
		"replicas": 1,
		"selector": map[string]any{
			"matchLabels": map[string]any{"app": "oauth2-proxy"},
		},
		"template": map[string]any{
			"metadata": map[string]any{"labels": map[string]any{"app": "oauth2-proxy"}},
			"spec": map[string]any{
				"containers": []any{
					map[string]any{
						"name":  "oauth2-proxy",
						"image": "quay.io/oauth2-proxy/oauth2-proxy:v7.5.0",
						"args": []any{
							"--provider=oidc",
							"--oidc-issuer-url=https://auth.yourcompany.com",
							"--upstream=file:///dev/null",
							"--http-address=0.0.0.0:4180",
						},
					},
				},
			},
		},
	}

	if err := proxy.Resource.SetValue("spec", deployment); err != nil {
		return err
	}

	return response.SetDesiredComposedResource(rsp, proxy)
}

func generateExternalSecret(req *fnv1.RunFunctionRequest, rsp *fnv1.RunFunctionResponse) error {
	observed, _ := request.GetObservedCompositeResource(req)
	secretRef, err := observed.GetValue("spec.features.sso.secretRef")
	if err != nil {
		return err
	}

	var ref map[string]any
	data, _ := json.Marshal(secretRef)
	if err := json.Unmarshal(data, &ref); err != nil {
		return err
	}

	store := "platform-vault"
	if s, ok := ref["store"].(string); ok && s != "" {
		store = s
	}
	path := ""
	if p, ok := ref["path"].(string); ok {
		path = p
	}

	es := &resource.DesiredComposed{
		Resource: resource.NewDesiredComposed(),
	}
	es.Resource.SetAPIVersion("external-secrets.io/v1")
	es.Resource.SetKind("ExternalSecret")

	spec := map[string]any{
		"refreshInterval": "1h",
		"secretStoreRef": map[string]any{
			"kind": "ClusterSecretStore",
			"name": store,
		},
		"target": map[string]any{
			"name":           "grafana-sso-credentials",
			"creationPolicy": "Owner",
		},
		"data": []any{
			map[string]any{
				"secretKey": "client-id",
				"remoteRef": map[string]any{"key": path, "property": "client-id"},
			},
			map[string]any{
				"secretKey": "client-secret",
				"remoteRef": map[string]any{"key": path, "property": "client-secret"},
			},
		},
	}

	if err := es.Resource.SetValue("spec", spec); err != nil {
		return err
	}

	return response.SetDesiredComposedResource(rsp, es)
}

func main() {}
