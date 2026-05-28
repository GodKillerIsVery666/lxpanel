package lxpanel

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"

    "github.com/hashicorp/terraform-plugin-framework/path"
    "github.com/hashicorp/terraform-plugin-framework/resource"
    "github.com/hashicorp/terraform-plugin-framework/resource/schema"
    "github.com/hashicorp/terraform-plugin-framework/types"
    "github.com/hashicorp/terraform-plugin-log/tflog"
)

type HostResource struct {
    client *LXPanelProvider
}

type HostResourceModel struct {
    Id      types.String   `tfsdk:"id"`
    Name    types.String   `tfsdk:"name"`
    Address types.String   `tfsdk:"address"`
    Tags    []types.String `tfsdk:"tags"`
    Port    types.Int64    `tfsdk:"port"`
    Group   types.String   `tfsdk:"group"`
}

func NewHostResource() resource.Resource {
    return &HostResource{}
}

func (r *HostResource) Metadata(_ context.Context, _ resource.MetadataRequest, resp *resource.MetadataResponse) {
    resp.TypeName = "lxpanel_host"
}

func (r *HostResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
    resp.Schema = schema.Schema{
        MarkdownDescription: "管理 LXPanel 主机资产",
        Attributes: map[string]schema.Attribute{
            "id":      schema.StringAttribute{Computed: true, MarkdownDescription: "主机 ID"},
            "name":    schema.StringAttribute{Required: true, MarkdownDescription: "主机名称"},
            "address": schema.StringAttribute{Required: true, MarkdownDescription: "主机地址"},
            "port":    schema.Int64Attribute{Optional: true, MarkdownDescription: "SSH 端口"},
            "group":   schema.StringAttribute{Optional: true, MarkdownDescription: "主机组"},
            "tags":    schema.ListAttribute{Optional: true, ElementType: types.StringType, MarkdownDescription: "标签列表"},
        },
    }
}

func (r *HostResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
    if req.ProviderData == nil {
        return
    }
    p, ok := req.ProviderData.(*LXPanelProvider)
    if !ok {
        resp.Diagnostics.AddError("Unexpected type", fmt.Sprintf("expected *LXPanelProvider, got %T", req.ProviderData))
        return
    }
    r.client = p
}

func (r *HostResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
    var plan HostResourceModel
    diags := req.Plan.Get(ctx, &plan)
    resp.Diagnostics.Append(diags...)
    if resp.Diagnostics.HasError() {
        return
    }

    body := map[string]any{
        "name":    plan.Name.ValueString(),
        "address": plan.Address.ValueString(),
        "port":    plan.Port.ValueInt64(),
        "group":   plan.Group.ValueString(),
    }
    if len(plan.Tags) > 0 {
        tags := make([]string, len(plan.Tags))
        for i, t := range plan.Tags {
            tags[i] = t.ValueString()
        }
        body["tags"] = tags
    }

    result, err := r.apiPost("/api/hosts", body)
    if err != nil {
        resp.Diagnostics.AddError("Create error", err.Error())
        return
    }

    plan.Id = types.StringValue(result["id"].(string))
    tflog.Info(ctx, "主机创建成功", map[string]any{"id": plan.Id.ValueString()})
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *HostResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
    var state HostResourceModel
    diags := req.State.Get(ctx, &state)
    resp.Diagnostics.Append(diags...)
    if resp.Diagnostics.HasError() {
        return
    }

    result, err := r.apiGet(fmt.Sprintf("/api/hosts/%s", state.Id.ValueString()))
    if err != nil {
        resp.Diagnostics.AddError("Read error", err.Error())
        return
    }

    state.Name = types.StringValue(result["name"].(string))
    state.Address = types.StringValue(result["address"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *HostResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
    var plan HostResourceModel
    diags := req.Plan.Get(ctx, &plan)
    resp.Diagnostics.Append(diags...)
    if resp.Diagnostics.HasError() {
        return
    }

    body := map[string]any{
        "name":    plan.Name.ValueString(),
        "address": plan.Address.ValueString(),
    }

    _, err := r.apiPut(fmt.Sprintf("/api/hosts/%s", plan.Id.ValueString()), body)
    if err != nil {
        resp.Diagnostics.AddError("Update error", err.Error())
        return
    }

    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *HostResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
    var state HostResourceModel
    diags := req.State.Get(ctx, &state)
    resp.Diagnostics.Append(diags...)
    if resp.Diagnostics.HasError() {
        return
    }

    _, err := r.apiDelete(fmt.Sprintf("/api/hosts/%s", state.Id.ValueString()))
    if err != nil {
        resp.Diagnostics.AddError("Delete error", err.Error())
        return
    }
}

func (r *HostResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
    resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// api helpers
func (r *HostResource) apiPost(path string, body any) (map[string]any, error) {
    return apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "POST", path, body)
}

func (r *HostResource) apiGet(path string) (map[string]any, error) {
    return apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "GET", path, nil)
}

func (r *HostResource) apiPut(path string, body any) (map[string]any, error) {
    return apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "PUT", path, body)
}

func (r *HostResource) apiDelete(path string) (map[string]any, error) {
    return apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "DELETE", path, nil)
}

func apiCall(client *http.Client, endpoint, apiToken, method, path string, body any) (map[string]any, error) {
    var reqBody []byte
    if body != nil {
        var err error
        reqBody, err = json.Marshal(body)
        if err != nil {
            return nil, fmt.Errorf("marshal error: %w", err)
        }
    }

    req, err := http.NewRequest(method, endpoint+path, bytes.NewBuffer(reqBody))
    if err != nil {
        return nil, fmt.Errorf("request error: %w", err)
    }
    req.Header.Set("Authorization", "Bearer "+apiToken)
    req.Header.Set("Content-Type", "application/json")

    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("http error: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("API error: %d", resp.StatusCode)
    }

    var result map[string]any
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode error: %w", err)
    }
    return result, nil
}
