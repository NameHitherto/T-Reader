use crate::model::FontNameEntry;

#[tauri::command]
pub fn get_system_fonts() -> Vec<FontNameEntry> {
    let mut db = fontdb::Database::new();
    // 加载系统字体
    db.load_system_fonts();

    let mut results = Vec::new();

    for face in db.faces() {
        // family名称
        let family = face
            .families
            .first()
            .map(|(name, _)| name.to_string())
            .unwrap_or_else(|| "Unknown".to_string());
        // PostScript 名称
        let postscript_name = Some(face.post_script_name.clone());
        // 样式
        let style = Some(match face.style {
            fontdb::Style::Normal => "Regular".to_string(),
            fontdb::Style::Italic => "Italic".to_string(),
            fontdb::Style::Oblique => "Oblique".to_string(),
        });
        // 字重
        let weight = Some(face.weight.0);
        // 文件路径
        let path = if let fontdb::Source::File(ref p) = face.source {
            Some(p.to_string_lossy().to_string())
        } else {
            None
        };
        // 结果包装
        results.push(FontNameEntry {
            family,
            postscript_name,
            style,
            weight,
            path,
        });
    }

    // 去重
    use std::collections::HashSet;
    let mut seen = HashSet::new();
    results
        .into_iter()
        .filter(|e| {
            let key = format!(
                "{}|{}|{}",
                e.family,
                e.postscript_name.clone().unwrap_or_default(),
                e.style.clone().unwrap_or_default()
            );
            seen.insert(key)
        })
        .collect()
}
