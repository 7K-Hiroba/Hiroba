// Command function-platform is the central Crossplane composition orchestrator (ADR 007).
//
// It serves a single FunctionRunnerService over gRPC. The handler registry is wired here;
// adding a new primitive means registering its apiVersion/kind → handler mapping.
//
// Platform-wide defaults are configured via environment variables:
//
//	PLATFORM_DEFAULT_POSTGRES_PROVIDER       default provider for PostgresInstance
//	PLATFORM_DEFAULT_OBJECT_STORAGE_PROVIDER default provider for ObjectBucket
//
// Precedence: XR spec.provider > these env defaults > contract defaults.
package main

import (
	"flag"
	"os"
	"sort"

	function "github.com/crossplane/function-sdk-go"
	"github.com/crossplane/function-sdk-go/logging"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/handlers"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

func main() {
	addr := flag.String("address", ":9443", "gRPC listen address")
	tlsDir := flag.String("tls-certs-dir", "/tls", "directory containing tls.crt and tls.key (mTLS)")
	insecure := flag.Bool("insecure", false, "serve without TLS (local development only)")
	metricsAddr := flag.String("metrics-address", ":8080", "Prometheus metrics listen address")
	debug := flag.Bool("debug", false, "enable debug logging")
	flag.Parse()

	log, err := logging.NewLogger(*debug)
	if err != nil {
		panic(err)
	}

	reg := platform.NewRegistry()
	reg.Register(contract.APIGroupVersion, "PostgresInstance", handlers.Postgres)
	reg.Register(contract.APIGroupVersion, "ObjectBucket", handlers.ObjectBucket)
	reg.Register(contract.APIGroupVersion, "GrafanaInstance", handlers.Grafana)
	reg.Register(contract.APIGroupVersion, "LokiInstance", handlers.Loki)

	cfg := platform.Config{
		DefaultProviders: map[string]string{
			"postgres":      os.Getenv("PLATFORM_DEFAULT_POSTGRES_PROVIDER"),
			"objectStorage": os.Getenv("PLATFORM_DEFAULT_OBJECT_STORAGE_PROVIDER"),
		},
	}

	keys := reg.Keys()
	sort.Strings(keys)
	for _, k := range keys {
		log.Info("registered handler", "composite", k)
	}
	log.Info("platform defaults", "postgres", cfg.DefaultProvider("postgres", contract.PostgresDefaultProvider),
		"objectStorage", cfg.DefaultProvider("objectStorage", contract.ObjectStorageDefaultProvider))

	fn := &platform.Function{Log: log, Registry: reg, Config: cfg}

	// mTLS by default (Crossplane always connects with mTLS); --insecure is for
	// local development and `crossplane composition render` only.
	opts := []function.ServeOption{
		function.Listen("tcp", *addr),
		function.Insecure(*insecure),
		function.WithMetricsServer(*metricsAddr),
	}
	if !*insecure {
		opts = append(opts, function.MTLSCertificates(*tlsDir))
	}

	if err := function.Serve(fn, opts...); err != nil {
		log.Info("function terminated", "error", err)
		os.Exit(1)
	}
}
