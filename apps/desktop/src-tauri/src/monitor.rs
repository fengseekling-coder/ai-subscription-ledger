use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// 每个 monitor 的检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorCheckResult {
    pub monitor_id: String,
    pub status: String,
    pub status_detail: String,
    pub remote_plan: String,
    pub remote_amount: f64,
    pub remote_renewal_date: String,
    pub error_message: String,
}

/// 从前端传入的 monitor 描述
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInput {
    pub id: String,
    pub service_id: String,
    pub api_key: String,
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct OpenAIUsage {
    #[serde(default)]
    total_usage: Option<f64>,
}

#[derive(Deserialize)]
struct OpenAISubscription {
    #[serde(default)]
    plan: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    end_date: Option<String>,
}

async fn check_openai(client: &Client, api_key: &str) -> Result<MonitorCheckResult, String> {
    let headers = format!("Bearer {}", api_key);

    // 尝试获取订阅信息
    let sub_resp = client
        .get("https://api.openai.com/v1/dashboard/billing/subscription")
        .header("Authorization", &headers)
        .send()
        .await;

    match sub_resp {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(sub) = resp.json::<OpenAISubscription>().await {
                let plan = sub.plan.unwrap_or_default();
                let status_str = sub.status.unwrap_or_default();
                let end_date = sub.end_date.unwrap_or_default();
                let status = if status_str == "active" || status_str == "active_trial" {
                    "active"
                } else {
                    "expired"
                };
                return Ok(MonitorCheckResult {
                    monitor_id: String::new(),
                    status: status.to_string(),
                    status_detail: format!("Plan: {}, Status: {}", plan, status_str),
                    remote_plan: plan,
                    remote_amount: 0.0,
                    remote_renewal_date: end_date,
                    error_message: String::new(),
                });
            }
        }
        _ => {}
    }

    // fallback: 尝试获取账单信息
    let now = Utc::now();
    let start_date = (now - chrono::Duration::days(180)).format("%Y-%m-%d").to_string();
    let end_date = now.format("%Y-%m-%d").to_string();
    let billing_url = format!(
        "https://api.openai.com/v1/dashboard/billing/usage?start_date={}&end_date={}",
        start_date, end_date
    );
    let billing_resp = client
        .get(&billing_url)
        .header("Authorization", &headers)
        .send()
        .await;

    match billing_resp {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(usage) = resp.json::<OpenAIUsage>().await {
                let total = usage.total_usage.unwrap_or(0.0);
                return Ok(MonitorCheckResult {
                    monitor_id: String::new(),
                    status: "active".to_string(),
                    status_detail: format!("累计使用 ${:.2}", total),
                    remote_plan: "Pay-as-you-go".to_string(),
                    remote_amount: total,
                    remote_renewal_date: String::new(),
                    error_message: String::new(),
                });
            }
        }
        _ => {}
    }

    // fallback: 尝试获取账单限额
    let limit_resp = client
        .get("https://api.openai.com/v1/organization/usage")
        .header("Authorization", &headers)
        .send()
        .await;

    match limit_resp {
        Ok(resp) if resp.status().is_success() => {
            return Ok(MonitorCheckResult {
                monitor_id: String::new(),
                status: "active".to_string(),
                status_detail: "API Key 有效".to_string(),
                remote_plan: "Unknown".to_string(),
                remote_amount: 0.0,
                remote_renewal_date: String::new(),
                error_message: String::new(),
            });
        }
        _ => {}
    }

    // 最终 fallback: 用 models endpoint 验证 key 有效性
    let models_resp = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", &headers)
        .send()
        .await;

    match models_resp {
        Ok(resp) if resp.status().is_success() => {
            return Ok(MonitorCheckResult {
                monitor_id: String::new(),
                status: "active".to_string(),
                status_detail: "API Key 有效".to_string(),
                remote_plan: "Unknown".to_string(),
                remote_amount: 0.0,
                remote_renewal_date: String::new(),
                error_message: String::new(),
            });
        }
        Ok(resp) => {
            let status = resp.status();
            return Err(format!("OpenAI API 验证失败 (HTTP {})", status));
        }
        Err(e) => return Err(format!("OpenAI API 请求失败: {}", e)),
    }
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────

async fn check_anthropic(client: &Client, api_key: &str) -> Result<MonitorCheckResult, String> {
    // Use the free /v1/models endpoint to verify API key validity
    // without incurring any message-generation costs.
    let resp = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await;

    match resp {
        Ok(resp) if resp.status().is_success() => {
            return Ok(MonitorCheckResult {
                monitor_id: String::new(),
                status: "active".to_string(),
                status_detail: "API Key 有效".to_string(),
                remote_plan: "Claude API".to_string(),
                remote_amount: 0.0,
                remote_renewal_date: String::new(),
                error_message: String::new(),
            });
        }
        Ok(resp) => {
            let status = resp.status();
            if status.as_u16() == 401 {
                return Ok(MonitorCheckResult {
                    monitor_id: String::new(),
                    status: "error".to_string(),
                    status_detail: "API Key 无效".to_string(),
                    remote_plan: String::new(),
                    remote_amount: 0.0,
                    remote_renewal_date: String::new(),
                    error_message: "API Key 无效或已过期".to_string(),
                });
            }
            return Err(format!("Anthropic API 验证失败 (HTTP {})", status));
        }
        Err(e) => return Err(format!("Anthropic API 请求失败: {}", e)),
    }
}

// ── Cursor ────────────────────────────────────────────────────────────────────

async fn check_cursor(client: &Client, api_key: &str) -> Result<MonitorCheckResult, String> {
    // WARNING: This is an unofficial, internal Cursor API endpoint.
    // It may change without notice. The response format is loosely parsed
    // (string contains matching), so it is inherently fragile.
    // If this breaks, the monitor will report an error but won't affect
    // the rest of the app.
    let resp = client
        .get("https://api2.cursor.sh/aiserver.v1.AiService/GetSubscription")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("content-type", "application/json")
        .send()
        .await;

    match resp {
        Ok(resp) if resp.status().is_success() => {
            let text = resp.text().await.unwrap_or_default();
            // Cursor 的响应格式可能变化，做基本解析
            if text.contains("Subscription") || text.contains("subscription") || text.contains("pro") {
                return Ok(MonitorCheckResult {
                    monitor_id: String::new(),
                    status: "active".to_string(),
                    status_detail: "Cursor Pro 订阅有效".to_string(),
                    remote_plan: "Cursor Pro".to_string(),
                    remote_amount: 20.0,
                    remote_renewal_date: String::new(),
                    error_message: String::new(),
                });
            }
            return Ok(MonitorCheckResult {
                monitor_id: String::new(),
                status: "active".to_string(),
                status_detail: "API Key 有效".to_string(),
                remote_plan: "Cursor".to_string(),
                remote_amount: 0.0,
                remote_renewal_date: String::new(),
                error_message: String::new(),
            });
        }
        Ok(resp) => {
            let status = resp.status();
            return Err(format!("Cursor API 验证失败 (HTTP {})", status));
        }
        Err(e) => return Err(format!("Cursor API 请求失败: {}", e)),
    }
}

// ── 公开 API ──────────────────────────────────────────────────────────────────

pub async fn check_monitor(client: &Client, input: &MonitorInput) -> MonitorCheckResult {
    let result = match input.service_id.as_str() {
        "openai" => check_openai(client, &input.api_key).await,
        "anthropic" => check_anthropic(client, &input.api_key).await,
        "cursor" => check_cursor(client, &input.api_key).await,
        _ => Err(format!("不支持的服务: {}", input.service_id)),
    };

    match result {
        Ok(mut r) => {
            r.monitor_id = input.id.clone();
            r
        }
        Err(e) => MonitorCheckResult {
            monitor_id: input.id.clone(),
            status: "error".to_string(),
            status_detail: String::new(),
            remote_plan: String::new(),
            remote_amount: 0.0,
            remote_renewal_date: String::new(),
            error_message: e,
        },
    }
}

pub async fn check_all_monitors(inputs: &[MonitorInput]) -> Vec<MonitorCheckResult> {
    const MAX_CONCURRENT: usize = 3;

    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            return inputs
                .iter()
                .map(|i| MonitorCheckResult {
                    monitor_id: i.id.clone(),
                    status: "error".to_string(),
                    status_detail: String::new(),
                    remote_plan: String::new(),
                    remote_amount: 0.0,
                    remote_renewal_date: String::new(),
                    error_message: "无法创建 HTTP 客户端".to_string(),
                })
                .collect();
        }
    };

    // Process in batches of MAX_CONCURRENT to avoid overwhelming APIs.
    let mut results = Vec::with_capacity(inputs.len());
    for chunk in inputs.chunks(MAX_CONCURRENT) {
        let mut batch = Vec::with_capacity(chunk.len());
        for input in chunk {
            batch.push(check_monitor(&client, input).await);
        }
        results.extend(batch);
    }
    results
}

/// 支持的监控服务描述
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedService {
    pub id: &'static str,
    pub label: &'static str,
    pub desc: &'static str,
    /// 关联的服务库条目 id（前端用于自动关联订阅）
    pub catalog_ids: Vec<&'static str>,
}

/// 支持的监控服务列表
pub fn supported_services() -> Vec<SupportedService> {
    vec![
        SupportedService {
            id: "openai",
            label: "OpenAI",
            desc: "支持 ChatGPT Plus/Team 及 API 用量查询",
            catalog_ids: vec!["chatgpt-plus", "chatgpt-team", "openai-api-usage"],
        },
        SupportedService {
            id: "anthropic",
            label: "Anthropic (Claude)",
            desc: "验证 Claude API Key 有效性",
            catalog_ids: vec!["claude-pro", "claude-api"],
        },
        SupportedService {
            id: "cursor",
            label: "Cursor",
            desc: "检查 Cursor Pro 订阅状态",
            catalog_ids: vec!["cursor-billing"],
        },
    ]
}
