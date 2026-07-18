#[cfg(target_os = "macos")]
pub fn ocr_image_rgba(rgba: &[u8], width: usize, height: usize) -> Result<String, String> {
    use objc2::AnyThread;
    use objc2_core_graphics::{
        CGColorRenderingIntent, CGColorSpace, CGDataProvider, CGImage, CGImageAlphaInfo,
        CGImageByteOrderInfo, CGBitmapInfo,
    };
    use objc2_foundation::{NSArray, NSDictionary, NSString};
    use objc2_vision::{
        VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel,
    };
    use std::ffi::c_void;
    use std::ptr::{self, NonNull};

    let expected = width
        .checked_mul(height)
        .and_then(|p| p.checked_mul(4))
        .ok_or_else(|| "图片尺寸过大".to_string())?;
    if rgba.len() != expected {
        return Err("RGBA 数据长度与宽高不匹配".to_string());
    }

    let pixels = rgba.to_vec();
    let pixels_len = pixels.len();
    let leaked = Box::into_raw(pixels.into_boxed_slice()) as *mut u8;

    unsafe extern "C-unwind" fn release(_info: *mut c_void, data: NonNull<c_void>, size: usize) {
        if size == 0 {
            return;
        }
        let ptr = data.as_ptr() as *mut u8;
        let _ = Box::from_raw(std::slice::from_raw_parts_mut(ptr, size));
    }

    let color_space = CGColorSpace::new_device_rgb().ok_or_else(|| "无法创建颜色空间".to_string())?;

    let provider = unsafe {
        CGDataProvider::with_data(
            ptr::null_mut(),
            leaked as *const c_void,
            pixels_len,
            Some(release),
        )
    }
    .ok_or_else(|| "无法创建数据提供者".to_string())?;

    let bitmap_info = CGBitmapInfo::AlphaInfoMask
        .union(CGBitmapInfo(CGImageAlphaInfo::PremultipliedLast.0))
        .union(CGBitmapInfo(CGImageByteOrderInfo::Order32Big.0));

    let cg_image = unsafe {
        CGImage::new(
            width,
            height,
            8,
            32,
            width * 4,
            Some(&color_space),
            bitmap_info,
            Some(&provider),
            ptr::null(),
            false,
            CGColorRenderingIntent::RenderingIntentDefault,
        )
    }
    .ok_or_else(|| "无法创建 CGImage".to_string())?;

    let options = NSDictionary::new();
    let handler = unsafe {
        VNImageRequestHandler::initWithCGImage_options(
            VNImageRequestHandler::alloc(),
            &cg_image,
            &options,
        )
    };

    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setAutomaticallyDetectsLanguage(true);

    let lang1 = NSString::from_str("zh-Hans");
    let lang2 = NSString::from_str("zh-Hant");
    let lang3 = NSString::from_str("en-US");
    let langs = NSArray::from_retained_slice(&[lang1, lang2, lang3]);
    request.setRecognitionLanguages(&langs);

    let vn_request: &VNRequest = &request;
    let requests = NSArray::from_slice(&[vn_request]);
    handler
        .performRequests_error(&requests)
        .map_err(|e| {
            let code = e.code();
            let domain = e.domain();
            let localized = e.localizedDescription();
            // 不臆测 VNError 码含义，保留系统文案 + 域/码便于排查
            format!("Vision OCR 失败 [{}:{}]: {}", domain, code, localized)
        })?;

    let results = request
        .results()
        .ok_or_else(|| "OCR 无结果".to_string())?;

    let mut lines = Vec::new();
    for obs in results.iter() {
        let candidates = obs.topCandidates(1);
        if let Some(text) = candidates.firstObject() {
            lines.push(text.string().to_string());
        }
    }

    let text = lines.join("\n");
    if text.is_empty() {
        Err("未识别到文字".to_string())
    } else {
        Ok(text)
    }
}

#[cfg(not(target_os = "macos"))]
pub fn ocr_image_rgba(_rgba: &[u8], _width: usize, _height: usize) -> Result<String, String> {
    Err("OCR 仅支持 macOS".to_string())
}
