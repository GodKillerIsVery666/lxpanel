package lxpanel

import (
    "context"
    "fmt"

    "github.com/hashicorp/terraform-plugin-framework/resource"
    "github.com/hashicorp/terraform-plugin-framework/resource/schema"
    "github.com/hashicorp/terraform-plugin-framework/types"
)

type UserResource struct {
    client *LXPanelProvider
}

type UserResourceModel struct {
    Id       types.String `tfsdk:"id"`
    Username types.String `tfsdk:"username"`
    Password types.String `tfsdk:"password"`
    Role     types.String `tfsdk:"role"`
    Email    types.String `tfsdk:"email"`
}

func NewUserResource() resource.Resource {
    return &UserResource{}
}

func (r *UserResource) Metadata(_ context.Context, _ resource.MetadataRequest, resp *resource.MetadataResponse) {
    resp.TypeName = "lxpanel_user"
}

func (r *UserResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
    resp.Schema = schema.Schema{
        MarkdownDescription: "管理 LXPanel 用户账号",
        Attributes: map[string]schema.Attribute{
            "id":       schema.StringAttribute{Computed: true},
            "username": schema.StringAttribute{Required: true, MarkdownDescription: "用户名"},
            "password": schema.StringAttribute{Required: true, Sensitive: true, MarkdownDescription: "密码"},
            "role":     schema.StringAttribute{Required: true, MarkdownDescription: "角色: owner/operator/viewer"},
            "email":    schema.StringAttribute{Optional: true, MarkdownDescription: "邮箱"},
        },
    }
}

func (r *UserResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *UserResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
    var plan UserResourceModel
    resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
    if resp.Diagnostics.HasError() {
        return
    }
    result, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "POST", "/api/users", map[string]any{
        "username": plan.Username.ValueString(),
        "password": plan.Password.ValueString(),
        "role":     plan.Role.ValueString(),
    })
    if err != nil {
        resp.Diagnostics.AddError("Create error", err.Error())
        return
    }
    plan.Id = types.StringValue(result["id"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *UserResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
    var state UserResourceModel
    resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
    if resp.Diagnostics.HasError() {
        return
    }
    result, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "GET", fmt.Sprintf("/api/users/%s", state.Id.ValueString()), nil)
    if err != nil {
        resp.Diagnostics.AddError("Read error", err.Error())
        return
    }
    state.Username = types.StringValue(result["username"].(string))
    resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *UserResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
    var plan UserResourceModel
    resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
    if resp.Diagnostics.HasError() {
        return
    }
    _, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "PUT", fmt.Sprintf("/api/users/%s", plan.Id.ValueString()), map[string]any{
        "role": plan.Role.ValueString(),
    })
    if err != nil {
        resp.Diagnostics.AddError("Update error", err.Error())
        return
    }
    resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *UserResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
    var state UserResourceModel
    resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
    if resp.Diagnostics.HasError() {
        return
    }
    _, err := apiCall(r.client.httpClient, r.client.endpoint, r.client.apiToken, "DELETE", fmt.Sprintf("/api/users/%s", state.Id.ValueString()), nil)
    if err != nil {
        resp.Diagnostics.AddError("Delete error", err.Error())
        return
    }
}
