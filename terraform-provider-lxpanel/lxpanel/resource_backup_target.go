package lxpanel

import (
    "context"
    "fmt"

    "github.com/hashicorp/terraform-plugin-framework/resource"
    "github.com/hashicorp/terraform-plugin-framework/resource/schema"
    "github.com/hashicorp/terraform-plugin-framework/types"
)

type BackupTargetResource struct {
    client *LXPanelProvider
}

type BackupTargetResourceModel struct {
    Id       types.String `tfsdk:"id"`
    Name     types.String `tfsdk:"name"`
    Type     types.String `tfsdk:"type"`
    Endpoint types.String `tfsdk:"endpoint"`
    Bucket   types.String `tfsdk:"bucket"`
    Region   types.String `tfsdk:"region"`
}

func NewBackupTargetResource() resource.Resource {
    return &BackupTargetResource{}
}

func (r *BackupTargetResource) Metadata(_ context.Context, _ resource.MetadataRequest, resp *resource.MetadataResponse) {
    resp.TypeName = "lxpanel_backup_target"
}

func (r *BackupTargetResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
    resp.Schema = schema.Schema{
        MarkdownDescription: "管理远程备份目标（S3/MinIO/COS/OSS）",
        Attributes: map[string]schema.Attribute{
            "id":       schema.StringAttribute{Computed: true},
            "name":     schema.StringAttribute{Required: true, MarkdownDescription: "备份目标名称"},
            "type":     schema.StringAttribute{Required: true, MarkdownDescription: "类型: s3/minio/cos/oss"},
            "endpoint": schema.StringAttribute{Required: true, MarkdownDescription: "端点地址"},
            "bucket":   schema.StringAttribute{Required: true, MarkdownDescription: "存储桶名称"},
            "region":   schema.StringAttribute{Optional: true, MarkdownDescription: "区域"},
        },
    }
}

func (r *BackupTargetResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *BackupTargetResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
    var plan BackupTargetResourceModel
    resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
    if resp.Diagnostics.HasError() {
        return
    }
    result, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "POST", "/api/backups/remote-targets", map[string]any{
        "name":     plan.Name.ValueString(),
        "type":     plan.Type.ValueString(),
        "endpoint": plan.Endpoint.ValueString(),
        "bucket":   plan.Bucket.ValueString(),
        "region":   plan.Region.ValueString(),
    })
    if err != nil {
        resp.Diagnostics.AddError("Create error", err.Error())
        return
    }
    plan.Id = types.StringValue(result["id"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *BackupTargetResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
    var state BackupTargetResourceModel
    resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
    if resp.Diagnostics.HasError() {
        return
    }
    result, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "GET", fmt.Sprintf("/api/backups/remote-targets/%s", state.Id.ValueString()), nil)
    if err != nil {
        resp.Diagnostics.AddError("Read error", err.Error())
        return
    }
    state.Name = types.StringValue(result["name"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *BackupTargetResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
    var plan BackupTargetResourceModel
    resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
    if resp.Diagnostics.HasError() {
        return
    }
    _, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "PUT", fmt.Sprintf("/api/backups/remote-targets/%s", plan.Id.ValueString()), map[string]any{
        "name":     plan.Name.ValueString(),
        "endpoint": plan.Endpoint.ValueString(),
        "bucket":   plan.Bucket.ValueString(),
    })
    if err != nil {
        resp.Diagnostics.AddError("Update error", err.Error())
        return
    }
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *BackupTargetResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
    var state BackupTargetResourceModel
    resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
    if resp.Diagnostics.HasError() {
        return
    }
    _, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "DELETE", fmt.Sprintf("/api/backups/remote-targets/%s", state.Id.ValueString()), nil)
    if err != nil {
        resp.Diagnostics.AddError("Delete error", err.Error())
        return
    }
}
