package main

import (
    "context"
    "flag"
    "log"

    "github.com/GodKillerIsVery666/lxpanel/terraform-provider-lxpanel/lxpanel"
    "github.com/hashicorp/terraform-plugin-framework/providerserver"
)

func main() {
    var debug bool
    flag.BoolVar(&debug, "debug", false, "set to true to run the provider with support for debuggers")
    flag.Parse()

    opts := providerserver.ServeOpts{
        Address: "registry.example.com/lxpanel/lxpanel",
        Debug:   debug,
    }

    err := providerserver.Serve(context.Background(), lxpanel.New, opts)
    if err != nil {
        log.Fatal(err)
    }
}
