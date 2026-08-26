use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const FRANKFURTER_API_BASE: &str = "https://api.frankfurter.dev/v1";
const REQUEST_TIMEOUT_SECONDS: u64 = 15;

/// 发给前端的不可变汇率快照。`rate_date` 可能早于请求日期（周末或节假日）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRateQuote {
    pub rate: f64,
    pub rate_date: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct FrankfurterResponse {
    date: String,
    rates: HashMap<String, f64>,
}

fn parse_usd_cny_quote(
    requested_date: &str,
    body: FrankfurterResponse,
) -> Result<ExchangeRateQuote, String> {
    NaiveDate::parse_from_str(requested_date, "%Y-%m-%d")
        .map_err(|_| "汇率日期必须为 YYYY-MM-DD".to_string())?;
    NaiveDate::parse_from_str(&body.date, "%Y-%m-%d")
        .map_err(|_| "汇率服务返回了无效日期".to_string())?;
    let rate = body
        .rates
        .get("CNY")
        .copied()
        .filter(|value| value.is_finite() && *value > 0.0)
        .ok_or_else(|| "汇率服务未返回 USD/CNY 数据".to_string())?;

    Ok(ExchangeRateQuote {
        rate,
        rate_date: body.date,
        source: "Frankfurter / ECB reference rates".to_string(),
    })
}

pub async fn usd_cny_rate_for(date: &str) -> Result<ExchangeRateQuote, String> {
    // 先验证再拼 URL，避免将任意用户输入放进请求路径。
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| "汇率日期必须为 YYYY-MM-DD".to_string())?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
        .build()
        .map_err(|e| format!("创建汇率请求失败: {}", e))?;
    let url = format!("{}/{}?base=USD&symbols=CNY", FRANKFURTER_API_BASE, date);
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("查询 USD/CNY 汇率失败: {}", e))?
        .error_for_status()
        .map_err(|e| format!("汇率服务响应异常: {}", e))?
        .json::<FrankfurterResponse>()
        .await
        .map_err(|e| format!("解析汇率服务响应失败: {}", e))?;
    parse_usd_cny_quote(date, response)
}

#[cfg(test)]
mod tests {
    use super::{parse_usd_cny_quote, FrankfurterResponse};
    use std::collections::HashMap;

    #[test]
    fn accepts_the_last_published_business_day_for_a_weekend_request() {
        let mut rates = HashMap::new();
        rates.insert("CNY".to_string(), 7.3183);
        let quote = parse_usd_cny_quote(
            "2025-01-04",
            FrankfurterResponse {
                date: "2025-01-03".to_string(),
                rates,
            },
        )
        .unwrap();

        assert_eq!(quote.rate, 7.3183);
        assert_eq!(quote.rate_date, "2025-01-03");
    }

    #[test]
    fn rejects_a_missing_or_invalid_rate() {
        let err = parse_usd_cny_quote(
            "2025-01-02",
            FrankfurterResponse {
                date: "2025-01-02".to_string(),
                rates: HashMap::new(),
            },
        )
        .unwrap_err();

        assert!(err.contains("USD/CNY"));
    }
}
