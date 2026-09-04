use crate::{
    entities::FontNameEntry,
    repository::font_metadata::{
        NamePreference, ParsedFontMetadata, collect_face_family_aliases, parse_face_metadata,
        pick_family_alias,
    },
};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};
use ttf_parser::Face;

pub fn load_system_fonts() -> Vec<FontNameEntry> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let mut results = Vec::new();

    for face in db.faces() {
        let path_buf = get_face_path(&face.source);
        let path = path_buf
            .as_ref()
            .map(|path| path.to_string_lossy().to_string());
        let parsed = path_buf
            .as_deref()
            .and_then(|font_path| parse_font_metadata(font_path, face.index));

        results.push(build_system_font_entry(face, path, parsed));
    }

    let mut seen = HashSet::new();
    results
        .into_iter()
        .filter(|entry| seen.insert(build_font_identity_key(entry)))
        .collect()
}

fn get_face_path(source: &fontdb::Source) -> Option<PathBuf> {
    match source {
        fontdb::Source::File(path) => Some(path.clone()),
        fontdb::Source::SharedFile(path, _) => Some(path.clone()),
        _ => None,
    }
}

fn parse_font_metadata(path: &Path, face_index: u32) -> Option<ParsedFontMetadata> {
    let data = fs::read(path).ok()?;
    let face = Face::parse(&data, face_index).ok()?;
    parse_face_metadata(&face)
}

fn build_system_font_entry(
    face: &fontdb::FaceInfo,
    path: Option<String>,
    parsed: Option<ParsedFontMetadata>,
) -> FontNameEntry {
    let fallback_family = pick_family_alias(&face.families, NamePreference::Canonical)
        .unwrap_or_else(|| "Unknown".to_string());
    let display_family = parsed
        .as_ref()
        .map(|metadata| metadata.display_family.clone())
        .or_else(|| pick_family_alias(&face.families, NamePreference::Display))
        .unwrap_or_else(|| fallback_family.clone());
    let family = parsed
        .as_ref()
        .map(|metadata| metadata.family.clone())
        .unwrap_or_else(|| fallback_family.clone());
    let family_aliases = parsed
        .as_ref()
        .map(|metadata| metadata.family_aliases.clone())
        .unwrap_or_else(|| collect_face_family_aliases(&face.families));

    FontNameEntry {
        family,
        display_family,
        subfamily: parsed
            .as_ref()
            .and_then(|metadata| metadata.subfamily.clone()),
        full_name: parsed
            .as_ref()
            .and_then(|metadata| metadata.full_name.clone()),
        postscript_name: parsed
            .as_ref()
            .and_then(|metadata| metadata.postscript_name.clone())
            .or_else(|| Some(face.post_script_name.clone())),
        weight: Some(face.weight.0),
        path,
        face_index: face.index,
        family_aliases,
    }
}

fn build_font_identity_key(entry: &FontNameEntry) -> String {
    let path = entry.path.as_deref().unwrap_or_default();

    if let Some(postscript_name) = &entry.postscript_name {
        return format!(
            "ps|{}|{}|{}",
            postscript_name.trim().to_lowercase(),
            path.to_lowercase(),
            entry.face_index
        );
    }

    if let Some(full_name) = &entry.full_name {
        return format!(
            "full|{}|{}|{}|{}",
            full_name.trim().to_lowercase(),
            entry.weight.unwrap_or_default(),
            path.to_lowercase(),
            entry.face_index
        );
    }

    format!(
        "family|{}|{}|{}|{}",
        entry.family.trim().to_lowercase(),
        entry.weight.unwrap_or_default(),
        path.to_lowercase(),
        entry.face_index
    )
}

#[cfg(test)]
mod tests {
    use super::build_system_font_entry;

    #[test]
    fn preserves_fontdb_fallback_fields_when_file_metadata_is_unavailable() {
        let face = fontdb::FaceInfo {
            id: fontdb::ID::dummy(),
            source: fontdb::Source::Binary(std::sync::Arc::new(Vec::<u8>::new())),
            index: 3,
            families: vec![
                (
                    "Fallback English".to_string(),
                    ttf_parser::Language::English_UnitedStates,
                ),
                (
                    "回退字体".to_string(),
                    ttf_parser::Language::Chinese_PeoplesRepublicOfChina,
                ),
            ],
            post_script_name: "FallbackPS".to_string(),
            style: fontdb::Style::Italic,
            weight: fontdb::Weight(613),
            stretch: fontdb::Stretch::Normal,
            monospaced: false,
        };

        let entry = build_system_font_entry(&face, None, None);

        assert_eq!(entry.family, "Fallback English");
        assert_eq!(entry.display_family, "回退字体");
        assert_eq!(entry.subfamily, None);
        assert_eq!(entry.full_name, None);
        assert_eq!(entry.postscript_name.as_deref(), Some("FallbackPS"));
        assert_eq!(entry.weight, Some(613));
        assert_eq!(entry.path, None);
        assert_eq!(entry.face_index, 3);
        assert_eq!(
            entry.family_aliases,
            vec!["Fallback English".to_string(), "回退字体".to_string()]
        );
    }
}
