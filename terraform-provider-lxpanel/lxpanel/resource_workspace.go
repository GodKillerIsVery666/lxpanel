package lxpanel

import (
    "context"
    "fmt"

    "github.com/hashicorp/terraform-plugin-framework/resource"
    "github.com/hashicorp/terraform-plugin-framework/resource/schema"
    "github.com/hashicorp/terraform-plugin-framework/types"
)

type WorkspaceResource struct {
    client *LXPanelProvider
}

type WorkspaceResourceModel struct {
    Id          types.String `tfsdk:"id"`
    Name        types.String `tfsdk:"name"`
    Description types.String `tfsdk:"description"`
}

func NewWorkspaceResource() resource.Resource {
    return &WorkspaceResource{}
}

func (r *WorkspaceResource) Metadata(_ context.Context, _ resource.MetadataRequest, resp *resource.MetadataResponse) {
    resp.TypeName = "lxpanel_workspace"
}

func (r *WorkspaceResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
    resp.Schema = schema.Schema{
        MarkdownDescription: "管理 LXPanel 工作空间",
        Attributes: map[string]schema.Attribute{
            "id":          schema.StringAttribute{Computed: true},
            "name":        schema.StringAttribute{Required: true, MarkdownDescription: "工作空间名称"},
            "description": schema.StringAttribute{Optional: true, MarkdownDescription: "描述"},
        },
    }
}

func (r *WorkspaceResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *WorkspaceResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
    var plan WorkspaceResourceModel
    resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
    if resp.Diagnostics.HasError() {
        return
    }
    result, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "POST", "/api/platform/workspaces", map[string]any{
        "name":        plan.Name.ValueString(),
        "description": plan.Description.ValueString(),
    })
    if err != nil {
        resp.Diagnostics.AddError("Create error", err.Error())
        return
    }
    plan.Id = types.StringValue(result["id"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *WorkspaceResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
    var state WorkspaceResourceModel
    resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
    if resp.Diagnostics.HasError() {
        return
    }
    result, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "GET", fmt.Sprintf("/api/platform/workspaces/%s", state.Id.ValueString()), nil)
    if err != nil {
        resp.Diagnostics.AddError("Read error", err.Error())
        return
    }
    state.Name = types.StringValue(result["name"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *WorkspaceResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
    var plan WorkspaceResourceModel
    resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
    if resp.Diagnostics.HasError() {
        return
    }
    _, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "PUT", fmt.Sprintf("/api/platform/workspaces/%s", plan.Id.ValueString()), map[string]any{
        "name":        plan.Name.ValueString(),
        "description": plan.Description.ValueString(),
    })
    if err != nil {
        resp.Diagnostics.AddError("Update error", err.Error())
        return
    }
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *WorkspaceResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
    var state WorkspaceResourceModel
    resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
    if resp.Diagnostics.HasError() {
        return
    }
    _, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "DELETE", fmt.Sprintf("/api/platform/workspaces/%s", state.Id.ValueString()), nil)
    if err != nil {
        resp.Diagnostics.AddError("Delete error", err.Error())
        return
    }
}
