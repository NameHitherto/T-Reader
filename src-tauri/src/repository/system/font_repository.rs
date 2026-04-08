use crate::entities::FontNameEntry;

pub fn load_system_fonts() -> Vec<FontNameEntry> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let mut results = Vec::new();

    for face in db.faces() {
        let family = face
            .families
            .first()
            .map(|(name, _)| name.to_string())
            .unwrap_or_else(|| "Unknown".to_string());
        let postscript_name = Some(face.post_script_name.clone());
        let style = Some(match face.style {
            fontdb::Style::Normal => "Regular".to_string(),
            fontdb::Style::Italic => "Italic".to_string(),
            fontdb::Style::Oblique => "Oblique".to_string(),
        });
        let weight = Some(face.weight.0);
        let path = if let fontdb::Source::File(ref p) = face.source {
            Some(p.to_string_lossy().to_string())
        } else {
            None
        };

        results.push(FontNameEntry {
            family,
            postscript_name,
            style,
            weight,
            path,
        });
    }

    use std::collections::HashSet;
    let mut seen = HashSet::new();
    results
        .into_iter()
        .filter(|entry| {
            let key = format!(
                "{}|{}|{}",
                entry.family,
                entry.postscript_name.clone().unwrap_or_default(),
                entry.style.clone().unwrap_or_default()
            );
            seen.insert(key)
        })
        .collect()
}
