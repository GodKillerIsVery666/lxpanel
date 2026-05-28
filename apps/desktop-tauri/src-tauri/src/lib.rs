use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use base64::Engine;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

const CREDENTIAL_SERVICE: &str = "lxpanel-desktop";
const CREDENTIAL_KEY: &str = "api-credentials";

/// 本地加密凭据
#[derive(Serialize, Deserialize, Clone, Default)]
struct ApiCredentials {
    panel_url: String,
    api_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    encrypted_url: Option<String>,
}

/// 应用状态：内存中的凭据缓存
struct AppState {
    credentials: Mutex<ApiCredentials>,
    encryption_key: Vec<u8>,
}

/// 系统托盘菜单动作
#[tauri::command]
fn show_about() -> String {
    serde_json::json!({
        "app": "LXPanel Desktop",
        "version": "0.1.0",
        "description": "面板桌面托盘客户端 - 企业内网巡检与通知"
    })
    .to_string()
}

/// 检查 API 健康状态
#[tauri::command]
async fn health_check(api_url: String) -> Result<String, String> {
    let url = format!("{}/api/health/ready", api_url.trim_end_matches('/'));
    match reqwest::get(&url).await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            Ok(serde_json::json!({"status": status}).to_string())
        }
        Err(e) => Err(format!("{{\"error\":\"{}\"}}", e)),
    }
}

/// 保存凭据到系统密钥链 + AES-256-GCM 加密
#[tauri::command]
async fn save_credentials(url: String, token: String) -> Result<String, String> {
    let key = derive_machine_key();
    let cipher = Aes256Gcm::new(Key::<aes_gcm::aes::Aes256>::from_slice(&key));
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = format!("{}|{}", url, token);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&combined);

    let entry = Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_KEY)
        .map_err(|e| format!("密钥链访问失败: {}", e))?;
    entry
        .set_password(&encoded)
        .map_err(|e| format!("密钥链写入失败: {}", e))?;
    Ok("ok".into())
}

/// 从系统密钥链读取凭据并解密
#[tauri::command]
async fn load_credentials() -> Result<ApiCredentials, String> {
    let entry = Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_KEY)
        .map_err(|_| "未找到凭据".into())?;
    let encoded = entry.get_password().map_err(|_| "未找到凭据".into())?;
    let combined = base64::engine::general_purpose::STANDARD
        .decode(&encoded)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;
    if combined.len() < 12 {
        return Err("数据格式无效".into());
    }
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let key = derive_machine_key();
    let cipher = Aes256Gcm::new(Key::<aes_gcm::aes::Aes256>::from_slice(&key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "解密失败".into())?;
    let plain_str = String::from_utf8(plaintext).map_err(|_| "数据格式无效".into())?;
    let parts: Vec<&str> = plain_str.splitn(2, '|').collect();
    if parts.len() != 2 {
        return Err("数据格式无效".into());
    }
    Ok(ApiCredentials {
        panel_url: parts[0].to_string(),
        api_token: parts[1].to_string(),
        encrypted_url: None,
    })
}

/// 发送桌面通知
#[tauri::command]
async fn send_notification(title: String, body: String) -> Result<String, String> {
    // 通过 Tauri 通知插件发送
    tauri_plugin_notification::Notification::new("com.lxpanel.desktop")
        .title(title)
        .body(body)
        .show()
        .map_err(|e| format!("通知发送失败: {}", e))?;
    Ok("ok".into())
}

/// 派生机器绑定密钥（用于 AES 加密本地凭据）
fn derive_machine_key() -> Vec<u8> {
    use sha2::{Digest, Sha256};
    let machine_id = machine_uid::get();
    let mut hasher = Sha256::new();
    hasher.update(b"lxpanel-desktop-credential-key-v1");
    hasher.update(machine_id.as_bytes());
    hasher.finalize().to_vec()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let encryption_key = derive_machine_key();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            credentials: Mutex::new(ApiCredentials::default()),
            encryption_key,
        })
        .setup(|app| {
            // 构建系统托盘菜单
            let open = MenuItem::with_id(app, "open", "打开面板", true, None::<&str>)?;
            let about = MenuItem::with_id(app, "about", "关于", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &about, &settings, &quit])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "about" => {
                        let _ = app.emit("show-about", ());
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = app.emit("open-settings", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_about,
            health_check,
            save_credentials,
            load_credentials,
            send_notification
        ])
        .run(tauri::generate_context!())
        .expect("启动 LXPanel Desktop 失败");
}
