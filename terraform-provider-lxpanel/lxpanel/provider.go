package lxpanel

import (
    "context"
    "net/http"
    "os"

    "github.com/hashicorp/terraform-plugin-framework/datasource"
    "github.com/hashicorp/terraform-plugin-framework/path"
    "github.com/hashicorp/terraform-plugin-framework/provider"
    "github.com/hashicorp/terraform-plugin-framework/provider/schema"
    "github.com/hashicorp/terraform-plugin-framework/resource"
    "github.com/hashicorp/terraform-plugin-framework/types"
    "github.com/hashicorp/terraform-plugin-log/tflog"
)

// LXPanelProvider 实现 provider.Provider 接口
type LXPanelProvider struct {
    endpoint string
    apiToken string
    httpClient *http.Client
}

type LXPanelProviderModel struct {
    Endpoint types.String `tfsdk:"endpoint"`
    ApiToken types.String `tfsdk:"api_token"`
}

func New() provider.Provider {
    return &LXPanelProvider{}
}

func (p *LXPanelProvider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
    resp.TypeName = "lxpanel"
}

func (p *LXPanelProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
    resp.Schema = schema.Schema{
        MarkdownDescription: "LXPanel 服务器运维面板 Terraform Provider",
        Attributes: map[string]schema.Attribute{
            "endpoint": schema.StringAttribute{
                MarkdownDescription: "LXPanel API 端点地址",
                Required:            true,
            },
            "api_token": schema.StringAttribute{
                MarkdownDescription: "LXPanel API Token（需要 platform:write scope）",
                Required:            true,
                Sensitive:           true,
            },
        },
    }
}

func (p *LXPanelProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
    var config LXPanelProviderModel
    diags := req.Config.Get(ctx, &config)
    resp.Diagnostics.Append(diags...)
    if resp.Diagnostics.HasError() {
        return
    }

    endpoint := os.Getenv("LXPANEL_ENDPOINT")
    if endpoint == "" {
        endpoint = config.Endpoint.ValueString()
    }
    apiToken := os.Getenv("LXPANEL_API_TOKEN")
    if apiToken == "" {
        apiToken = config.ApiToken.ValueString()
    }

    if endpoint == "" {
        resp.Diagnostics.AddAttributeError(path.Root("endpoint"), "Missing Endpoint", "endpoint is required")
        return
    }
    if apiToken == "" {
        resp.Diagnostics.AddAttributeError(path.Root("api_token"), "Missing API Token", "api_token is required")
        return
    }

    p.endpoint = endpoint
    p.apiToken = apiToken
    p.httpClient = &http.Client{}

    tflog.Info(ctx, "LXPanel Provider 配置完成", map[string]any{"endpoint": endpoint})
}

func (p *LXPanelProvider) DataSources(_ context.Context) []func() datasource.DataSource {
    return nil
}

func (p *LXPanelProvider) Resources(_ context.Context) []func() resource.Resource {
    return []func() resource.Resource{
        NewHostResource,
        NewBackupTargetResource,
        NewUserResource,
        NewWorkspaceResource,
    }
}
