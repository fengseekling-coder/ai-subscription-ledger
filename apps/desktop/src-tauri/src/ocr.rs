use std::ffi::CString;
use std::os::raw::{c_char, c_void};

extern "C" {
    fn objc_getClass(name: *const c_char) -> *mut c_void;
    fn sel_registerName(name: *const c_char) -> *mut c_void;
    fn objc_msgSend(obj: *mut c_void, sel: *mut c_void, ...) -> *mut c_void;
}

// Helper: send message with no args
unsafe fn msg_send_0(obj: *mut c_void, sel_name: &str) -> *mut c_void {
    let sel_c = CString::new(sel_name).unwrap();
    let sel = sel_registerName(sel_c.as_ptr());
    objc_msgSend(obj, sel)
}

// Helper: send message with 1 pointer arg
unsafe fn msg_send_1(obj: *mut c_void, sel_name: &str, arg: *mut c_void) -> *mut c_void {
    let sel_c = CString::new(sel_name).unwrap();
    let sel = sel_registerName(sel_c.as_ptr());
    objc_msgSend(obj, sel, arg)
}

// Helper: send message with 1 usize arg
unsafe fn msg_send_usize(obj: *mut c_void, sel_name: &str, arg: usize) -> *mut c_void {
    let sel_c = CString::new(sel_name).unwrap();
    let sel = sel_registerName(sel_c.as_ptr());
    objc_msgSend(obj, sel, arg)
}

// Helper: send message with 2 pointer args
unsafe fn msg_send_2(obj: *mut c_void, sel_name: &str, arg1: *mut c_void, arg2: *mut c_void) -> *mut c_void {
    let sel_c = CString::new(sel_name).unwrap();
    let sel = sel_registerName(sel_c.as_ptr());
    objc_msgSend(obj, sel, arg1, arg2)
}

// Helper: get NSString as Rust String
unsafe fn nsstring_to_string(obj: *mut c_void) -> String {
    if obj.is_null() {
        return String::new();
    }
    let sel_c = CString::new("UTF8String").unwrap();
    let sel = sel_registerName(sel_c.as_ptr());
    let ptr: *const c_char = objc_msgSend(obj, sel) as *const c_char;
    if ptr.is_null() {
        return String::new();
    }
    std::ffi::CStr::from_ptr(ptr).to_string_lossy().into_owned()
}

// Helper: make NSString from Rust str
unsafe fn make_nsstring(s: &str) -> *mut c_void {
    let cls = objc_getClass(CString::new("NSString").unwrap().as_ptr());
    let s_c = CString::new(s).unwrap();
    let sel_c = CString::new("stringWithUTF8String:").unwrap();
    let sel = sel_registerName(sel_c.as_ptr());
    objc_msgSend(cls, sel, s_c.as_ptr())
}

/// 用 macOS Vision Framework 对 RGBA 字节做 OCR，返回识别到的文本
pub fn ocr_image_rgba(rgba: &[u8], width: usize, height: usize) -> Result<String, String> {
    unsafe {
        // Step 1: create CGImage from raw RGBA bytes
        let cg_image = create_cgimage_from_rgba(rgba, width, height)?;
        if cg_image.is_null() {
            return Err("无法从图片数据创建 CGImage".to_string());
        }

        // Step 2: VNImageRequestHandler
        let handler_cls = objc_getClass(CString::new("VNImageRequestHandler").unwrap().as_ptr());
        let handler_alloc = msg_send_0(handler_cls, "alloc");
        let empty_dict = msg_send_0(objc_getClass(CString::new("NSDictionary").unwrap().as_ptr()), "new");
        let handler = msg_send_2(handler_alloc, "initWithCGImage:options:", cg_image, empty_dict);
        if handler.is_null() {
            return Err("创建 VNImageRequestHandler 失败".to_string());
        }

        // Step 3: VNRecognizeTextRequest
        let req_cls = objc_getClass(CString::new("VNRecognizeTextRequest").unwrap().as_ptr());
        let req_alloc = msg_send_0(req_cls, "alloc");
        let request = msg_send_0(req_alloc, "init");
        if request.is_null() {
            return Err("创建 VNRecognizeTextRequest 失败".to_string());
        }

        // setRecognitionLanguages: ["zh-Hans", "en-US"]
        let nsarray_cls = objc_getClass(CString::new("NSArray").unwrap().as_ptr());
        let langs_arr = {
            let sel_c = CString::new("arrayWithObjects:count:").unwrap();
            let sel = sel_registerName(sel_c.as_ptr());
            let lang1 = make_nsstring("zh-Hans");
            let lang2 = make_nsstring("en-US");
            let objs = [lang1, lang2];
            objc_msgSend(nsarray_cls, sel, objs.as_ptr() as *mut c_void, 2usize)
        };
        let sel_c = CString::new("setRecognitionLanguages:").unwrap();
        let sel = sel_registerName(sel_c.as_ptr());
        objc_msgSend(request, sel, langs_arr);

        // setRecognitionLevel: 1 (accurate)
        let sel_c = CString::new("setRecognitionLevel:").unwrap();
        let sel = sel_registerName(sel_c.as_ptr());
        objc_msgSend(request, sel, 1usize);

        // Step 4: arrayWithObject: request
        let requests_arr = {
            let sel_c = CString::new("arrayWithObject:").unwrap();
            let sel = sel_registerName(sel_c.as_ptr());
            objc_msgSend(nsarray_cls, sel, request)
        };

        // Step 5: performRequests:error:
        let mut err: *mut c_void = std::ptr::null_mut();
        let ok: bool = {
            let sel_c = CString::new("performRequests:error:").unwrap();
            let sel = sel_registerName(sel_c.as_ptr());
            objc_msgSend(handler, sel, requests_arr, &mut err as *mut *mut c_void as *mut c_void)
                != std::ptr::null_mut()
        };

        if !ok {
            let err_msg = if !err.is_null() {
                nsstring_to_string(msg_send_0(err, "localizedDescription"))
            } else {
                "unknown".to_string()
            };
            return Err(format!("Vision OCR 失败: {}", err_msg));
        }

        // Step 6: collect text from results
        let results = msg_send_0(request, "results");
        if results.is_null() {
            return Err("OCR 无结果".to_string());
        }

        let count: usize = {
            let sel_c = CString::new("count").unwrap();
            let sel = sel_registerName(sel_c.as_ptr());
            msg_send_0(results, "count") as usize
        };

        let mut text_parts = Vec::new();
        for i in 0..count {
            let obs = msg_send_usize(results, "objectAtIndex:", i);
            if obs.is_null() {
                continue;
            }
            let candidates = msg_send_usize(obs, "topCandidates:", 1);
            if candidates.is_null() {
                continue;
            }
            let candidate = msg_send_0(candidates, "firstObject");
            if candidate.is_null() {
                continue;
            }
            let s = msg_send_0(candidate, "string");
            text_parts.push(nsstring_to_string(s));
        }

        let text = text_parts.join("\n");
        if text.is_empty() {
            Err("未识别到文字".to_string())
        } else {
            Ok(text)
        }
    }
}

unsafe fn create_cgimage_from_rgba(rgba: &[u8], width: usize, height: usize) -> Result<*mut c_void, String> {
    // NSBitmapImageRep — 最直接的方式从 raw RGBA 创建 CGImage
    let cls = objc_getClass(CString::new("NSBitmapImageRep").unwrap().as_ptr());
    if cls.is_null() {
        return Err("NSBitmapImageRep not found".to_string());
    }

    // initWithBitmapDataPixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:colorSpaceName:bytesPerRow:bitsPerPixel:
    let alloc = msg_send_0(cls, "alloc");
    let sel_c = CString::new("initWithBitmapDataPixelsWide:pixelsHigh:bitsPerSample:samplesPerPixel:hasAlpha:colorSpaceName:bytesPerRow:bitsPerPixel:").unwrap();
    let sel = sel_registerName(sel_c.as_ptr());

    let w = width as usize;
    let h = height as usize;
    let bps = 8usize;
    let spp = 4usize; // RGBA
    let alpha = 1usize;
    let colorspace_name = make_nsstring("NSDeviceRGBColorSpace");
    let bpr = w * 4;
    let bpp = 32usize;

    let bitmap = objc_msgSend(
        alloc, sel,
        w as usize,
        h as usize,
        bps as usize,
        spp as usize,
        alpha as usize,
        colorspace_name,
        bpr as usize,
        bpp as usize,
    );

    if bitmap.is_null() {
        return Err("创建 NSBitmapImageRep 失败".to_string());
    }

    // copy raw pixel bytes into bitmap
    let raw_sel_c = CString::new("bitmapData").unwrap();
    let raw_sel = sel_registerName(raw_sel_c.as_ptr());
    let raw_ptr: *mut c_void = objc_msgSend(bitmap, raw_sel) as *mut c_void;

    if raw_ptr.is_null() {
        return Err("获取 bitmapData 失败".to_string());
    }

    // RGBA from JS is row-major, NSBitmapImageRep also stores row-major,
    // but we need to handle alpha channel correctly
    std::ptr::copy_nonoverlapping(rgba.as_ptr(), raw_ptr as *mut u8, rgba.len());

    // CGImage from NSBitmapImageRep
    let cgimage_sel_c = CString::new("CGImage").unwrap();
    let cgimage_sel = sel_registerName(cgimage_sel_c.as_ptr());
    let cgimage: *mut c_void = objc_msgSend(bitmap, cgimage_sel);

    Ok(cgimage)
}
