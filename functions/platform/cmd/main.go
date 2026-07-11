// Command function-platform is the central Crossplane composition orchestrator (ADR 007).
//
// It serves a single FunctionRunnerService over gRPC. The handler registry is wired here;
// adding a new primitive means registering its kind → handler mapping.
package main

import (
	"crypto/tls"
	"flag"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/crossplane/function-sdk-go/logging"
	fnv1 "github.com/crossplane/function-sdk-go/proto/v1"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/handlers"
)

func main() {
	addr := flag.String("address", ":9443", "gRPC listen address")
	tlsDir := flag.String("tls-certs-dir", "/tls", "directory containing tls.crt and tls.key")
	insecure := flag.Bool("insecure", false, "serve without TLS (local development only)")
	flag.Parse()

	log := logging.NewNopLogger()

	reg := platform.NewRegistry()
	reg.Register("PostgresInstance", handlers.Postgres)
	reg.Register("ObjectBucket", handlers.ObjectBucket)
	reg.Register("GrafanaInstance", handlers.Grafana)
	reg.Register("LokiInstance", handlers.Loki)

	fn := &platform.Function{Log: log, Registry: reg}

	srv, err := newServer(*tlsDir, *insecure)
	if err != nil {
		panic(err)
	}
	fnv1.RegisterFunctionRunnerServiceServer(srv, fn)

	lis, err := net.Listen("tcp", *addr)
	if err != nil {
		panic(err)
	}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		srv.GracefulStop()
	}()

	if err := srv.Serve(lis); err != nil {
		panic(err)
	}
}

func newServer(tlsDir string, insecure bool) (*grpc.Server, error) {
	if insecure {
		return grpc.NewServer(), nil
	}
	cert, err := tls.LoadX509KeyPair(filepath.Join(tlsDir, "tls.crt"), filepath.Join(tlsDir, "tls.key"))
	if err != nil {
		return nil, err
	}
	creds := credentials.NewTLS(&tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12})
	return grpc.NewServer(grpc.Creds(creds)), nil
}
